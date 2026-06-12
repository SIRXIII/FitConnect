import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, ChevronLeft, Send, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useSupportTickets, useTicketMessages } from '@/hooks/useSupportTickets';
import { useAuthStore } from '@/stores/auth';
import type { SupportTicket, TicketStatus, TicketPriority } from '@/types/support';
import {
  STATUS_LABELS,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
} from '@/types/support';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  waiting_on_user: 'bg-purple-50 text-purple-700 border-purple-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-ink/5 text-ink/70 border-ink/10',
};

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-ink/20',
  normal: 'bg-blue-400',
  high: 'bg-amber-400',
  urgent: 'bg-red-500',
};

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'xs' }> = ({
  status,
  size = 'sm',
}) => (
  <span
    className={`inline-flex items-center border ${STATUS_STYLES[status] ?? 'bg-ink/5 text-ink/70 border-ink/10'} ${
      size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'
    }`}
  >
    {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}
  </span>
);

// ─── Ticket Detail Panel ──────────────────────────────────────────────────────

const TicketDetail: React.FC<{
  ticket: SupportTicket;
  onBack: () => void;
  onUpdate: () => void;
}> = ({ ticket, onBack, onUpdate }) => {
  const { user } = useAuthStore();
  const { sendMessage, updateTicketStatus, updateTicketPriority } = useSupportTickets(true);
  const { messages, loading: messagesLoading, refetch } = useTicketMessages(ticket.id);

  const [reply, setReply] = useState('');
  const [adminNotes, setAdminNotes] = useState(ticket.admin_notes ?? '');
  const [sending, setSending] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<TicketStatus>(ticket.status);
  const [currentPriority, setCurrentPriority] = useState<TicketPriority>(ticket.priority);

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

  const handleStatusChange = async (status: TicketStatus) => {
    try {
      await updateTicketStatus(ticket.id, status);
      setCurrentStatus(status);
      onUpdate();
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handlePriorityChange = async (priority: TicketPriority) => {
    try {
      await updateTicketPriority(ticket.id, priority);
      setCurrentPriority(priority);
      onUpdate();
      toast.success('Priority updated');
    } catch {
      toast.error('Failed to update priority');
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await updateTicketStatus(ticket.id, currentStatus, adminNotes);
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-ink/70 hover:text-ink transition-colors"
      >
        <ChevronLeft size={13} />
        Back to queue
      </button>

      {/* Header */}
      <div className="border border-ink/10 p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-medium text-ink">{ticket.subject}</h3>
            <p className="text-xs text-ink/70 mt-1">
              {ticket.user?.full_name ?? 'Unknown'} ·{' '}
              {new Date(ticket.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              · <span className="font-mono">{ticket.id.slice(0, 8).toUpperCase()}</span>
            </p>
          </div>
          <StatusBadge status={currentStatus} />
        </div>
        {ticket.description && (
          <p className="text-sm text-ink/60 leading-relaxed pt-3 border-t border-ink/5">
            {ticket.description}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-ink/70 mb-1.5">
            Status
          </label>
          <select
            value={currentStatus}
            onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
            className="w-full px-3 py-2 bg-white border border-ink/10 text-sm text-ink rounded-none focus:outline-none focus:border-accent transition-colors"
          >
            {(Object.keys(STATUS_LABELS) as TicketStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-ink/70 mb-1.5">
            Priority
          </label>
          <select
            value={currentPriority}
            onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
            className="w-full px-3 py-2 bg-white border border-ink/10 text-sm text-ink rounded-none focus:outline-none focus:border-accent transition-colors"
          >
            {(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Admin Notes */}
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-ink/70 mb-1.5">
          Internal Admin Notes
        </label>
        <textarea
          rows={3}
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder="Internal notes (not visible to the user)"
          className="w-full px-3 py-2 bg-ink/3 border border-ink/10 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-accent transition-colors resize-none"
        />
        <button
          onClick={handleSaveNotes}
          disabled={savingNotes}
          className="mt-2 px-4 py-1.5 text-xs border border-ink/20 text-ink hover:bg-ink/5 transition-colors disabled:opacity-40"
        >
          {savingNotes ? 'Saving...' : 'Save Notes'}
        </button>
      </div>

      {/* Message thread */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-ink/70 mb-3">Conversation</p>
        <div className="space-y-3 max-h-96 overflow-y-auto border border-ink/10 p-4 bg-white">
          {messagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin text-ink/30" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-xs text-ink/30 text-center py-6">No messages yet.</p>
          ) : (
            messages.map((msg) => {
              const isAdmin = msg.is_admin;
              const isCurrentUser = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 text-sm ${
                      isCurrentUser
                        ? 'bg-accent text-white'
                        : isAdmin
                        ? 'bg-ink text-white'
                        : 'bg-ink/5 text-ink'
                    }`}
                  >
                    {!isCurrentUser && (
                      <p className="text-[10px] opacity-80 mb-0.5 uppercase tracking-wider font-semibold">
                        {isAdmin ? 'Support Team' : (msg.sender?.full_name ?? 'User')}
                      </p>
                    )}
                    <p className="leading-relaxed">{msg.message}</p>
                    <p className="text-[10px] opacity-80 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Reply */}
      <div className="flex items-end gap-2">
        <textarea
          rows={2}
          placeholder="Reply to user..."
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 px-3 py-2.5 bg-white border border-ink/10 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-accent transition-colors resize-none"
        />
        <button
          onClick={handleSend}
          disabled={sending || !reply.trim()}
          className="px-4 py-2.5 bg-ink text-white hover:bg-ink/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>
    </div>
  );
};

// ─── Main Admin Support Queue ─────────────────────────────────────────────────

const AdminSupportQueue: React.FC = () => {
  const { tickets, loading, refetch, updateTicketStatus } = useSupportTickets(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const openCount = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;

  const filtered = tickets
    .filter((t) => statusFilter === 'all' || t.status === statusFilter)
    .filter((t) => categoryFilter === 'all' || t.category === categoryFilter)
    .filter((t) => priorityFilter === 'all' || t.priority === priorityFilter)
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 2;
      const pb = PRIORITY_ORDER[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  if (selectedTicket) {
    return (
      <div className="p-6">
        <TicketDetail
          ticket={selectedTicket}
          onBack={() => {
            setSelectedTicket(null);
            refetch();
          }}
          onUpdate={refetch}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xs uppercase tracking-[0.25em] font-medium text-ink/70">
            Support Queue
          </h3>
          {openCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-accent text-white rounded-full">
              {openCount}
            </span>
          )}
        </div>
        <button
          onClick={refetch}
          className="text-xs text-ink/70 hover:text-ink transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-white border border-ink/10 text-xs text-ink rounded-none focus:outline-none focus:border-accent transition-colors"
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 bg-white border border-ink/10 text-xs text-ink rounded-none focus:outline-none focus:border-accent transition-colors"
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-1.5 bg-white border border-ink/10 text-xs text-ink rounded-none focus:outline-none focus:border-accent transition-colors"
        >
          <option value="all">All Priorities</option>
          {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-ink/30" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <CheckCircle size={28} className="mx-auto text-green-400 mb-3" />
          <p className="text-sm text-ink/70">No tickets match the current filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10">
                <th className="text-left text-[10px] uppercase tracking-widest text-ink/70 font-medium pb-3 pr-4">
                  Priority
                </th>
                <th className="text-left text-[10px] uppercase tracking-widest text-ink/70 font-medium pb-3 pr-4">
                  Subject
                </th>
                <th className="text-left text-[10px] uppercase tracking-widest text-ink/70 font-medium pb-3 pr-4">
                  User
                </th>
                <th className="text-left text-[10px] uppercase tracking-widest text-ink/70 font-medium pb-3 pr-4">
                  Category
                </th>
                <th className="text-left text-[10px] uppercase tracking-widest text-ink/70 font-medium pb-3 pr-4">
                  Status
                </th>
                <th className="text-left text-[10px] uppercase tracking-widest text-ink/70 font-medium pb-3">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className="border-b border-ink/5 hover:bg-ink/2 cursor-pointer transition-colors"
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[ticket.priority]}`}
                      />
                      <span className="text-xs text-ink/50">
                        {PRIORITY_LABELS[ticket.priority]}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="text-sm text-ink font-medium truncate max-w-[200px]">
                      {ticket.subject}
                    </p>
                    <p className="text-[10px] text-ink/30 font-mono">
                      {ticket.id.slice(0, 8).toUpperCase()}
                    </p>
                  </td>
                  <td className="py-3 pr-4 text-sm text-ink/60">
                    {ticket.user?.full_name ?? '—'}
                  </td>
                  <td className="py-3 pr-4 text-xs text-ink/50">
                    {CATEGORY_LABELS[ticket.category]}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={ticket.status} size="xs" />
                  </td>
                  <td className="py-3 text-xs text-ink/70">
                    {new Date(ticket.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminSupportQueue;
export { AdminSupportQueue };
