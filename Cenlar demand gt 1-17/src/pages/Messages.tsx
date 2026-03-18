import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, ChevronLeft, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { SkeletonLine } from '@/components/shared/Skeleton';

interface ConversationParticipant {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Conversation {
  id: string;
  trainer_id: string;
  client_id: string;
  updated_at: string;
  trainer: ConversationParticipant;
  client: ConversationParticipant;
  last_message?: string;
  unread_count?: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

const Messages: React.FC = () => {
  const { user } = useAuthStore();
  const { refetch: refetchUnread } = useUnreadMessages();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('conv'));
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showThread, setShowThread] = useState(!!searchParams.get('conv'));
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Fetch conversations ─────────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoadingConvos(true);

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id, trainer_id, client_id, updated_at,
        trainer:trainer_id ( id, full_name, avatar_url ),
        client:client_id  ( id, full_name, avatar_url )
      `)
      .or(`trainer_id.eq.${user.id},client_id.eq.${user.id}`)
      .order('updated_at', { ascending: false });

    if (error) { toast.error('Failed to load conversations'); setLoadingConvos(false); return; }

    // Fetch last message + unread count for each conversation
    const enriched = await Promise.all(
      (data ?? []).map(async (conv: any) => {
        const [lastMsg, unreadRes] = await Promise.all([
          supabase
            .from('messages')
            .select('content')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('read', false)
            .neq('sender_id', user.id),
        ]);
        return {
          ...conv,
          trainer: Array.isArray(conv.trainer) ? conv.trainer[0] : conv.trainer,
          client: Array.isArray(conv.client) ? conv.client[0] : conv.client,
          last_message: lastMsg.data?.content ?? '',
          unread_count: unreadRes.count ?? 0,
        } as Conversation;
      })
    );

    setConversations(enriched);
    setLoadingConvos(false);
  }, [user]);

  // ── Fetch messages for selected conversation ────────────────────────────────
  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (error) { toast.error('Failed to load messages'); setLoadingMessages(false); return; }
    setMessages((data ?? []) as Message[]);
    setLoadingMessages(false);
  }, []);

  // ── Mark messages as read ───────────────────────────────────────────────────
  const markRead = useCallback(async (convId: string) => {
    if (!user) return;
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', convId)
      .eq('read', false)
      .neq('sender_id', user.id);

    // Update local unread count
    setConversations((prev) =>
      prev.map((c) => c.id === convId ? { ...c, unread_count: 0 } : c)
    );
    refetchUnread();
  }, [user, refetchUnread]);

  // ── Select conversation ─────────────────────────────────────────────────────
  const selectConversation = useCallback((id: string) => {
    setSelectedId(id);
    setShowThread(true);
    setSearchParams({ conv: id });
    fetchMessages(id);
    markRead(id);
  }, [fetchMessages, markRead, setSearchParams]);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId);
      markRead(selectedId);
    }
  }, [selectedId, fetchMessages, markRead]);

  // ── Realtime: new messages in selected conversation ─────────────────────────
  useEffect(() => {
    if (!selectedId) return;

    const channel = supabase
      .channel(`messages-${selectedId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          markRead(selectedId);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedId, markRead]);

  // ── Realtime: conversation list updates ─────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('conversations-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetchConversations)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchConversations)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchConversations]);

  // ── Auto-scroll to bottom ───────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedId || !user || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const { error } = await supabase.from('messages').insert({
      conversation_id: selectedId,
      sender_id: user.id,
      content,
    });

    setSending(false);

    if (error) {
      toast.error('Failed to send message');
      setNewMessage(content); // restore on failure
    } else {
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getOtherParticipant = (conv: Conversation): ConversationParticipant => {
    return conv.trainer_id === user?.id ? conv.client : conv.trainer;
  };

  const selectedConv = conversations.find((c) => c.id === selectedId);
  const otherParticipant = selectedConv ? getOtherParticipant(selectedConv) : null;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-paper pt-24 pb-0">
      <div className="max-w-6xl mx-auto h-[calc(100vh-6rem)] flex flex-col">

        {/* Page header */}
        <div className="px-6 py-6 border-b border-ink/10">
          <h1 className="text-2xl serif font-light italic text-ink">Messages</h1>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* ── Conversation list (hidden on mobile when thread open) ─────── */}
          <aside className={`w-full md:w-80 lg:w-96 border-r border-ink/10 flex flex-col overflow-hidden
            ${showThread ? 'hidden md:flex' : 'flex'}`}
          >
            {loadingConvos ? (
              <div className="flex-1 px-5 py-4 space-y-4">
                <SkeletonLine width="w-full" className="h-16" />
                <SkeletonLine width="w-full" className="h-16" />
                <SkeletonLine width="w-full" className="h-16" />
                <SkeletonLine width="w-full" className="h-16" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center px-8 text-center space-y-4">
                <MessageSquare size={32} strokeWidth={1} className="text-ink/15" />
                <p className="text-xs uppercase tracking-[0.2em] text-ink/30">No conversations yet</p>
                <p className="text-[10px] text-ink/20">Message a trainer from their profile page</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {conversations.map((conv) => {
                  const other = getOtherParticipant(conv);
                  const isSelected = conv.id === selectedId;
                  const initials = other.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';

                  return (
                    <button
                      key={conv.id}
                      onClick={() => selectConversation(conv.id)}
                      className={`w-full text-left px-5 py-4 border-b border-ink/5 flex items-center gap-4 transition-colors
                        ${isSelected ? 'bg-ink/5' : 'hover:bg-ink/3'}`}
                    >
                      {/* Avatar */}
                      {other.avatar_url ? (
                        <img
                          src={other.avatar_url}
                          alt={other.full_name}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-ink/8 border border-ink/10 flex items-center justify-center text-xs font-medium text-ink/50 shrink-0">
                          {initials}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${(conv.unread_count ?? 0) > 0 ? 'font-semibold text-ink' : 'font-medium text-ink/80'}`}>
                            {other.full_name || 'Unknown'}
                          </p>
                          <span className="text-[9px] text-ink/30 shrink-0">{formatTime(conv.updated_at)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-[11px] text-ink/40 truncate">{conv.last_message || 'No messages yet'}</p>
                          {(conv.unread_count ?? 0) > 0 && (
                            <span className="w-4 h-4 rounded-full bg-accent text-white text-[8px] font-bold flex items-center justify-center shrink-0">
                              {conv.unread_count! > 9 ? '9+' : conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          {/* ── Thread panel ─────────────────────────────────────────────── */}
          <main className={`flex-1 flex flex-col overflow-hidden
            ${!showThread ? 'hidden md:flex' : 'flex'}`}
          >
            {!selectedId ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center px-8">
                <MessageSquare size={40} strokeWidth={1} className="text-ink/10" />
                <p className="text-xs uppercase tracking-[0.2em] text-ink/25">Select a conversation</p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="px-6 py-4 border-b border-ink/10 flex items-center gap-4 shrink-0">
                  <button
                    onClick={() => { setShowThread(false); setSearchParams({}); }}
                    className="md:hidden p-1.5 text-ink/40 hover:text-ink transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  {otherParticipant?.avatar_url ? (
                    <img
                      src={otherParticipant.avatar_url}
                      alt={otherParticipant.full_name}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-ink/8 border border-ink/10 flex items-center justify-center text-xs font-medium text-ink/50">
                      {otherParticipant?.full_name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-ink">{otherParticipant?.full_name || 'Unknown'}</p>
                    <p className="text-[9px] uppercase tracking-widest text-ink/30">
                      {selectedConv?.trainer_id === user?.id ? 'Client' : 'Trainer'}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                  {loadingMessages ? (
                    <div className="space-y-4 py-4">
                      <SkeletonLine width="w-full" className="h-16" />
                      <SkeletonLine width="w-full" className="h-16" />
                      <SkeletonLine width="w-full" className="h-16" />
                      <SkeletonLine width="w-full" className="h-16" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-xs text-ink/25 uppercase tracking-[0.2em]">No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const isMine = msg.sender_id === user?.id;
                      const showTime =
                        i === 0 ||
                        new Date(msg.created_at).getTime() - new Date(messages[i - 1].created_at).getTime() > 5 * 60 * 1000;

                      return (
                        <div key={msg.id}>
                          {showTime && (
                            <p className="text-center text-[9px] uppercase tracking-widest text-ink/20 my-4">
                              {new Date(msg.created_at).toLocaleString('en-US', {
                                month: 'short', day: 'numeric',
                                hour: 'numeric', minute: '2-digit', hour12: true,
                              })}
                            </p>
                          )}
                          <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[70%] px-4 py-3 text-sm leading-relaxed ${
                                isMine
                                  ? 'bg-ink text-white'
                                  : 'bg-ink/5 text-ink border border-ink/8'
                              }`}
                            >
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="px-6 py-4 border-t border-ink/10 shrink-0">
                  <div className="flex items-end gap-3">
                    <textarea
                      ref={inputRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message… (Enter to send)"
                      rows={1}
                      maxLength={2000}
                      className="flex-1 resize-none border border-ink/10 px-4 py-3 text-sm text-ink bg-transparent placeholder-ink/25 focus:outline-none focus:border-ink/25 max-h-32 overflow-y-auto"
                      style={{ height: 'auto' }}
                      onInput={(e) => {
                        const el = e.currentTarget;
                        el.style.height = 'auto';
                        el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                      }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!newMessage.trim() || sending}
                      className="p-3 bg-ink text-white hover:bg-accent transition-colors duration-300 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Messages;
