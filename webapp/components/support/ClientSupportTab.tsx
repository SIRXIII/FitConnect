import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Send,
  PlusCircle,
  Loader2,
  CheckCircle,
  LifeBuoy,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useSupportTickets, useTicketMessages } from '@/hooks/useSupportTickets';
import type { SupportTicket, TicketCategory } from '@/types/support';
import { STATUS_LABELS, CATEGORY_LABELS } from '@/types/support';

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

// ─── Thread View (embedded) ──────────────────────────────────────────────────

const EmbeddedThread: React.FC<{
  ticket: SupportTicket;
  onBack: () => void;
}> = ({ ticket, onBack }) => {
  const { user } = useAuthStore();
  const { sendMessage } = useSupportTickets();
  const { messages, loading: messagesLoading, refetch } = useTicketMessages(ticket.id);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = reply.trim();
    if (!text) return;
    setSending(true);
    try {
      await sendMessage(ticket.id, text);
      setReply('');
      await refetch();
    } catch {
      toast.error('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-ink/40 hover:text-ink transition-colors"
      >
        <ChevronLeft size={13} />
        Back to tickets
      </button>

      {/* Ticket header */}
      <div className="border border-ink/10 px-5 py-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-medium text-ink leading-snug">{ticket.subject}</h3>
          <StatusBadge status={ticket.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink/40">
          <span>{CATEGORY_LABELS[ticket.category]}</span>
          <span>·</span>
          <span>
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
          <p className="text-sm text-ink/60 leading-relaxed pt-2 border-t border-ink/5 mt-2">
            {ticket.description}
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="space-y-3 max-h-[28rem] overflow-y-auto border border-ink/10 p-4 bg-white">
        {messagesLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={18} className="animate-spin text-ink/30" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-ink/30 text-center py-8">
            No messages yet. Our team will respond shortly.
          </p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === user?.id;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[78%] px-4 py-3 text-sm leading-relaxed ${
                    isOwn
                      ? 'bg-accent text-white'
                      : msg.is_admin
                      ? 'bg-ink text-white'
                      : 'bg-ink/5 text-ink'
                  }`}
                >
                  {msg.is_admin && !isOwn && (
                    <p className="text-xs font-semibold opacity-60 mb-1 uppercase tracking-wider">
                      FitRush Support
                    </p>
                  )}
                  <p>{msg.message}</p>
                  <p className={`text-xs mt-1.5 ${isOwn || msg.is_admin ? 'opacity-50' : 'text-ink/30'}`}>
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

      {/* Reply */}
      {ticket.status !== 'closed' && ticket.status !== 'resolved' ? (
        <div className="flex items-end gap-2">
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
      ) : (
        <p className="text-xs text-ink/30 text-center py-3 border-t border-ink/5">
          This ticket has been {ticket.status}. Need more help? Submit a new ticket.
        </p>
      )}
    </div>
  );
};

// ─── New Ticket Form (embedded) ──────────────────────────────────────────────

interface RecentBooking {
  id: string;
  created_at: string;
  trainer_name: string;
  slot_time: string;
}

const EmbeddedNewTicket: React.FC<{
  onBack: () => void;
  onCreated: (ticketId: string) => void;
}> = ({ onBack, onCreated }) => {
  const { user } = useAuthStore();
  const { createTicket } = useSupportTickets();

  const [category, setCategory] = useState<TicketCategory>('other');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [relatedBookingId, setRelatedBookingId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingBookings(true);
    supabase
      .from('bookings')
      .select('id, created_at, availability_slots(start_time), trainer_profiles(profiles(full_name))')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) {
          setRecentBookings(
            data.map((b: any) => ({
              id: b.id,
              created_at: b.created_at,
              trainer_name: b.trainer_profiles?.profiles?.full_name ?? 'Unknown Trainer',
              slot_time: b.availability_slots?.start_time ?? b.created_at,
            }))
          );
        }
        setLoadingBookings(false);
      });
  }, [user]);

  const showBookingField = ['payment', 'booking', 'dispute'].includes(category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const ticket = await createTicket({
        category,
        subject: subject.trim(),
        description: description.trim(),
        related_booking_id: relatedBookingId || null,
      });
      if (ticket) {
        onCreated(ticket.id);
      }
    } catch {
      toast.error('Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-ink/40 hover:text-ink transition-colors"
      >
        <ChevronLeft size={13} />
        Back to tickets
      </button>

      <div>
        <h3 className="text-sm font-medium text-ink mb-1">Submit a Support Ticket</h3>
        <p className="text-xs text-ink/40">Our team typically responds within 24 hours.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-medium mb-1.5">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as TicketCategory);
              setRelatedBookingId('');
            }}
            className="w-full px-3 py-2.5 bg-white border border-ink/10 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {showBookingField && (
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-medium mb-1.5">
              Related Booking <span className="normal-case font-normal text-ink/30">(optional)</span>
            </label>
            {loadingBookings ? (
              <p className="text-xs text-ink/30 py-2">Loading bookings...</p>
            ) : (
              <select
                value={relatedBookingId}
                onChange={(e) => setRelatedBookingId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-ink/10 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
              >
                <option value="">— Select a booking —</option>
                {recentBookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.trainer_name} —{' '}
                    {new Date(b.slot_time).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-medium mb-1.5">
            Subject
          </label>
          <input
            type="text"
            required
            placeholder="Brief summary of your issue"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
            className="w-full px-3 py-2.5 bg-white border border-ink/10 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-ink/40 font-medium mb-1.5">
            Description
          </label>
          <textarea
            required
            rows={5}
            placeholder="Please describe your issue in detail."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-ink/10 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-accent transition-colors resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !subject.trim() || !description.trim()}
          className="w-full py-3 bg-accent text-white text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting ? 'Submitting...' : 'Submit Ticket'}
        </button>
      </form>
    </div>
  );
};

// ─── Main Client Support Tab ─────────────────────────────────────────────────

type View = { kind: 'list' } | { kind: 'thread'; ticket: SupportTicket } | { kind: 'new' };

const ClientSupportTab: React.FC = () => {
  const { tickets, loading, refetch } = useSupportTickets();
  const [view, setView] = useState<View>({ kind: 'list' });

  if (view.kind === 'thread') {
    return (
      <EmbeddedThread
        ticket={view.ticket}
        onBack={() => {
          refetch();
          setView({ kind: 'list' });
        }}
      />
    );
  }

  if (view.kind === 'new') {
    return (
      <EmbeddedNewTicket
        onBack={() => setView({ kind: 'list' })}
        onCreated={(ticketId) => {
          toast.success(`Ticket submitted — #${ticketId.slice(0, 8).toUpperCase()}`);
          refetch();
          setView({ kind: 'list' });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LifeBuoy size={16} className="text-ink/30" />
          <h3 className="text-xs uppercase tracking-[0.2em] font-medium text-ink/40">
            My Support Tickets
          </h3>
        </div>
        <button
          onClick={() => setView({ kind: 'new' })}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors"
        >
          <PlusCircle size={14} />
          New Ticket
        </button>
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={22} className="animate-spin text-ink/30" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <LifeBuoy size={28} className="mx-auto text-ink/15" />
          <p className="text-sm text-ink/40">No tickets yet.</p>
          <button
            onClick={() => setView({ kind: 'new' })}
            className="px-5 py-2.5 text-sm bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            Submit Your First Ticket
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => setView({ kind: 'thread', ticket })}
              className="w-full flex items-center gap-4 px-5 py-4 bg-white border border-ink/10 hover:border-accent/30 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{ticket.subject}</p>
                <div className="flex items-center gap-2 text-xs text-ink/40 mt-1">
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
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientSupportTab;
