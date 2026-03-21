import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import type { TicketCategory } from '@/types/support';
import { CATEGORY_LABELS } from '@/types/support';

interface RecentBooking {
  id: string;
  created_at: string;
  trainer_name: string;
  slot_time: string;
}

const SubmitTicketForm: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createTicket } = useSupportTickets();

  const [category, setCategory] = useState<TicketCategory>('other');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [relatedBookingId, setRelatedBookingId] = useState('');
  const [relatedUserSearch, setRelatedUserSearch] = useState('');
  const [relatedUserId, setRelatedUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState<{ id: string; full_name: string }[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingBookings(true);

    supabase
      .from('bookings')
      .select(
        'id, created_at, availability_slots(start_time), trainer_profiles(profiles(full_name))'
      )
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

  useEffect(() => {
    if ((category !== 'dispute' && category !== 'report_user') || !relatedUserSearch.trim()) {
      setUserSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingUsers(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .ilike('full_name', `%${relatedUserSearch}%`)
        .neq('id', user?.id ?? '')
        .limit(5);
      setUserSearchResults(data ?? []);
      setSearchingUsers(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [relatedUserSearch, category, user?.id]);

  const showBookingField = ['payment', 'booking', 'dispute'].includes(category);
  const showUserField = ['dispute', 'report_user'].includes(category);

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
        related_user_id: relatedUserId || null,
      });

      if (ticket) {
        setSubmittedTicketId(ticket.id);
      }
    } catch (err) {
      toast.error('Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedTicketId) {
    return (
      <div className="min-h-screen bg-paper pt-28 pb-24 px-6">
        <div className="max-w-lg mx-auto text-center space-y-6 pt-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 rounded-full">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-medium text-ink mb-2">Ticket Submitted</h2>
            <p className="text-sm text-ink/50">
              We've received your request. You'll hear back within 24 hours.
            </p>
            <p className="text-xs text-ink/30 mt-2 font-mono">
              Ticket #{submittedTicketId.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div className="flex gap-3 justify-center pt-4">
            <button
              onClick={() => navigate('/help/tickets')}
              className="px-5 py-2.5 text-sm bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              View My Tickets
            </button>
            <button
              onClick={() => navigate('/help')}
              className="px-5 py-2.5 text-sm border border-ink/20 text-ink hover:bg-ink/5 transition-colors"
            >
              Back to Help Center
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pt-28 pb-24 px-6">
      <div className="max-w-lg mx-auto">
        {/* Back link */}
        <button
          onClick={() => navigate('/help')}
          className="flex items-center gap-1.5 text-sm text-ink/40 hover:text-ink transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          Help Center
        </button>

        <div className="mb-8">
          <h1 className="text-2xl serif font-light italic text-ink mb-1">Submit a Support Ticket</h1>
          <p className="text-sm text-ink/50">Our team typically responds within 24 hours.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-ink/40 mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as TicketCategory);
                setRelatedBookingId('');
                setRelatedUserId('');
                setRelatedUserSearch('');
              }}
              className="w-full px-4 py-3 bg-white border border-ink/10 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Related Booking */}
          {showBookingField && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-ink/40 mb-2">
                Related Booking <span className="normal-case font-normal">(optional)</span>
              </label>
              {loadingBookings ? (
                <div className="text-xs text-ink/40 py-2">Loading bookings...</div>
              ) : (
                <select
                  value={relatedBookingId}
                  onChange={(e) => setRelatedBookingId(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-ink/10 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
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

          {/* Related User */}
          {showUserField && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-ink/40 mb-2">
                Related User <span className="normal-case font-normal">(optional — search by name)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={relatedUserId ? userSearchResults.find((u) => u.id === relatedUserId)?.full_name ?? relatedUserSearch : relatedUserSearch}
                  onChange={(e) => {
                    setRelatedUserSearch(e.target.value);
                    if (relatedUserId) setRelatedUserId('');
                  }}
                  className="w-full px-4 py-3 bg-white border border-ink/10 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
                />
                {searchingUsers && (
                  <Loader2 size={14} className="absolute right-3 top-3.5 text-ink/30 animate-spin" />
                )}
                {userSearchResults.length > 0 && !relatedUserId && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-ink/10 shadow-md z-10">
                    {userSearchResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setRelatedUserId(u.id);
                          setRelatedUserSearch(u.full_name);
                          setUserSearchResults([]);
                        }}
                        className="w-full px-4 py-2.5 text-sm text-left text-ink hover:bg-ink/5 transition-colors"
                      >
                        {u.full_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-ink/40 mb-2">
              Subject
            </label>
            <input
              type="text"
              required
              placeholder="Brief summary of your issue"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={120}
              className="w-full px-4 py-3 bg-white border border-ink/10 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-ink/40 mb-2">
              Description
            </label>
            <textarea
              required
              rows={6}
              placeholder="Please describe your issue in detail. Include any relevant dates, amounts, or steps you've already tried."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-ink/10 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-accent transition-colors resize-none"
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
    </div>
  );
};

export default SubmitTicketForm;
