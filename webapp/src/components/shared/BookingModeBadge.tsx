interface BookingModeBadgeProps {
  mode: 'instant' | 'request';
}

const BookingModeBadge: React.FC<BookingModeBadgeProps> = ({ mode }) => {
  if (mode === 'instant') {
    return (
      <span className="text-[10px] uppercase tracking-[0.2em] text-accent font-medium">
        Instant Book
      </span>
    );
  }

  return (
    <span className="text-[10px] uppercase tracking-[0.2em] text-ink/40 font-medium">
      Request to Book
    </span>
  );
};

export default BookingModeBadge;
