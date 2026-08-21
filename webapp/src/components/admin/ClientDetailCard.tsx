export interface AdminClientDetail {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_suspended: boolean;
  created_at: string;
  email: string;
  last_sign_in_at: string | null;
  total_bookings: number;
  completed_count: number;
  cancelled_count: number;
  no_show_count: number;
  total_spend: number;
  recent_bookings: Array<{
    id: string;
    status: string;
    rate_charged: number;
    start_time: string;
    trainer_name: string | null;
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    trainer_name: string | null;
  }>;
}

interface Props {
  client: AdminClientDetail;
}

const ClientDetailCard: React.FC<Props> = ({ client }) => {
  return (
    <div className="border border-ink/10">

      {/* ── SECTION 1: Header — identity ── */}
      <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-ink/10 bg-ink/[0.02]">
        <div className="flex items-start gap-4 min-w-0">
          {client.avatar_url ? (
            <img
              src={client.avatar_url}
              alt={client.full_name ?? 'Client'}
              className="w-16 h-16 rounded-full object-cover border border-ink/10 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-ink/5 border border-ink/10 flex items-center justify-center text-lg text-ink/40 shrink-0">
              {(client.full_name?.trim() || client.email || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-lg text-ink font-medium truncate">{client.full_name?.trim() || 'No name provided'}</p>
              {client.is_suspended && (
                <span className="text-[10px] uppercase tracking-[0.15em] text-red-700 font-medium whitespace-nowrap">
                  Suspended
                </span>
              )}
            </div>
            <p className="text-sm text-ink/60 truncate">
              <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a>
              {' · '}
              {client.phone?.trim() ? (
                <a href={`tel:${client.phone.replace(/[^\d+]/g, '')}`} className="hover:underline">
                  {client.phone}
                </a>
              ) : (
                <span className="text-ink/40 italic">No phone on file</span>
              )}
            </p>
            <p className="text-xs text-ink/50 mt-0.5">
              Joined {new Date(client.created_at).toLocaleDateString()}
              {client.last_sign_in_at && ` · Last sign-in ${new Date(client.last_sign_in_at).toLocaleDateString()}`}
            </p>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Booking Summary ── */}
      <div className="border-t border-ink/10 px-6 py-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-4">Booking Summary</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-8 gap-y-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Total</p>
            <p className="text-sm text-ink tabular-nums">{client.total_bookings}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Completed</p>
            <p className="text-sm text-ink tabular-nums">{client.completed_count}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Cancelled</p>
            <p className="text-sm text-ink tabular-nums">{client.cancelled_count}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">No-Show</p>
            <p className="text-sm text-ink tabular-nums">{client.no_show_count}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-1.5">Total Spend</p>
            <p className="text-sm text-ink tabular-nums">${Number(client.total_spend).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: Recent Bookings ── */}
      <div className="border-t border-ink/10 px-6 py-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-3">Recent Bookings</p>
        {client.recent_bookings.length > 0 ? (
          <div className="space-y-2">
            {client.recent_bookings.map((booking) => (
              <div key={booking.id} className="flex items-center gap-3 flex-wrap text-sm">
                <span className="text-ink/70 tabular-nums">
                  {new Date(booking.start_time).toLocaleDateString()}
                </span>
                <span className="text-ink">{booking.trainer_name ?? 'Unknown trainer'}</span>
                <span className="text-[10px] uppercase tracking-wider font-medium text-ink/50">
                  {booking.status}
                </span>
                <span className="text-ink/70 tabular-nums">${Number(booking.rate_charged).toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/40 italic">No bookings yet.</p>
        )}
      </div>

      {/* ── SECTION 4: Reviews Written ── */}
      <div className="border-t border-ink/10 px-6 py-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/55 font-medium mb-3">Reviews Written</p>
        {client.reviews.length > 0 ? (
          <div className="space-y-3">
            {client.reviews.map((review) => (
              <div key={review.id} className="border border-ink/10 px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-ink">{'★'.repeat(review.rating)}{'☆'.repeat(Math.max(0, 5 - review.rating))}</span>
                  <span className="text-sm text-ink/70">{review.trainer_name ?? 'Unknown trainer'}</span>
                  <span className="text-xs text-ink/50">{new Date(review.created_at).toLocaleDateString()}</span>
                </div>
                {review.comment?.trim() && (
                  <p className="text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">{review.comment.trim()}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/40 italic">No reviews yet.</p>
        )}
      </div>

    </div>
  );
};

export default ClientDetailCard;
