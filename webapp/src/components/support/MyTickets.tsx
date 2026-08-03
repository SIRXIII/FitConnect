import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Loader2, PlusCircle, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useSupportTickets, useTicketMessages } from '@/hooks/useSupportTickets';
import { useAuthStore } from '@/stores/auth';
import type { SupportTicket } from '@/types/support';
import { STATUS_LABELS, CATEGORY_LABELS, PRIORITY_LABELS } from '@/types/support';

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  waiting_on_user: 'bg-purple-50 text-purple-700 border-purple-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-ink/5 text-ink/40 border-ink/10',
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-flex items-center px-2.5 py-0.5 text-xs border ${STATUS_STYLES[status] ?? 'bg-ink/5 text-ink/40 border-ink/10'}`}
  >
    {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}
  </span>
);

// ─── Ticket Thread ────────────────────────────────────────────────────────────

const TicketThread: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { tickets, sendMessage } = useSupportTickets();
  const { messages, loading: messagesLoading, refetch } = useTicketMessages(id ?? null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const ticket = tickets.find((t) => t.id === id);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = reply.trim();
    if (!text || !id) return;
    setSending(true);
    try {
      await sendMessage(id, text);
      setReply('');
      await refetch();
    } catch {
      toast.error('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  if (!ticket) {
    return (
      <div className="min-h-screen bg-paper pt-28 pb-24 px-6">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/help/tickets')}
            className="flex items-center gap-1.5 text-sm text-ink/40 hover:text-ink transition-colors mb-8"
          >
            <ArrowLeft size={14} />
            My Tickets
          </button>
          <p className="text-sm text-ink/50">Ticket not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 12rem)' }}>
        {/* Back */}
        <button
          onClick={() => navigate('/help/tickets')}
          className="flex items-center gap-1.5 text-sm text-ink/40 hover:text-ink transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          My Tickets
        </button>

        {/* Ticket header */}
        <div className="bg-white border border-ink/10 px-5 py-4 mb-6 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-medium text-ink leading-snug">{ticket.subject}</h2>
            <StatusBadge status={ticket.status} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink/40">
            <span>{CATEGORY_LABELS[ticket.category]}</span>
            <span>·</span>
            <span>
              Opened{' '}
              {new Date(ticket.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span>·</span>
            <span className="font-mono">{ticket.id.slice(0, 8).toUpperCase()}</span>
          </div>
          {ticket.description && (
            <p className="text-sm text-ink/60 leading-relaxed pt-1 border-t border-ink/5 mt-2">
              {ticket.description}
            </p>
          )}
        </div>

        {/* Message thread */}
        <div className="flex-1 space-y-3 mb-4 overflow-y-auto">
          {messagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-ink/30" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-ink/30 text-center py-8">
              No messages yet. Our team will respond shortly.
            </p>
          ) : (
            messages.map((msg) => {
              const isOwnMessage = msg.sender_id === user?.id;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[78%] px-4 py-3 text-sm leading-relaxed ${
                      isOwnMessage
                        ? 'bg-accent text-white'
                        : msg.is_admin
                        ? 'bg-ink text-white'
                        : 'bg-white border border-ink/10 text-ink'
                    }`}
                  >
                    {msg.is_admin && !isOwnMessage && (
                      <p className="text-xs font-semibold opacity-60 mb-1 uppercase tracking-wider">
                        FitRush Support
                      </p>
                    )}
                    <p>{msg.message}</p>
                    <p
                      className={`text-xs mt-1.5 ${
                        isOwnMessage || msg.is_admin ? 'opacity-50' : 'text-ink/30'
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Reply box */}
        {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
          <div className="flex items-end gap-2 mt-auto">
            <textarea
              rows={2}
              placeholder="Write a reply..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 px-4 py-3 bg-white border border-ink/10 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-accent transition-colors resize-none"
            />
            <button
              onClick={handleSend}
              disabled={sending || !reply.trim()}
              className="px-4 py-3 bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        )}

        {(ticket.status === 'closed' || ticket.status === 'resolved') && (
          <p className="text-xs text-ink/30 text-center py-4 border-t border-ink/5 mt-4">
            This ticket has been {ticket.status}. If you need further assistance, please submit a new ticket.
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Ticket List ─────────────────────────────────────────────────────────────

const TicketListItem: React.FC<{ ticket: SupportTicket; onClick: () => void }> = ({
  ticket,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-4 px-5 py-4 bg-white border border-ink/10 hover:border-accent/30 transition-colors text-left"
  >
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-sm font-medium text-ink truncate">{ticket.subject}</p>
      </div>
      <div className="flex items-center gap-2 text-xs text-ink/40">
        <span>{CATEGORY_LABELS[ticket.category]}</span>
        <span>·</span>
        <span>
          {new Date(ticket.updated_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </div>
    <StatusBadge status={ticket.status} />
    <ChevronRight size={14} className="text-ink/20 flex-shrink-0" />
  </button>
);

const MyTicketsList: React.FC = () => {
  const navigate = useNavigate();
  const { tickets, loading } = useSupportTickets();

  return (
    <div className="min-h-screen bg-paper pt-28 pb-24 px-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/help')}
          className="flex items-center gap-1.5 text-sm text-ink/40 hover:text-ink transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          Help Center
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl serif font-light italic text-ink">My Tickets</h1>
          <button
            onClick={() => navigate('/help/new-ticket')}
            className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
          >
            <PlusCircle size={15} />
            New Ticket
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-ink/30" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-sm text-ink/40">You haven't submitted any tickets yet.</p>
            <button
              onClick={() => navigate('/help/new-ticket')}
              className="px-5 py-2.5 text-sm bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              Submit Your First Ticket
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <TicketListItem
                key={ticket.id}
                ticket={ticket}
                onClick={() => navigate(`/help/tickets/${ticket.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Exports ─────────────────────────────────────────────────────────────────

export { MyTicketsList, TicketThread };
export default MyTicketsList;
