interface PromoTickerProps {
  /** Formatted promo end date, e.g. "December 1". */
  endsOn: string;
}

/**
 * Breaking-news style promo ticker, pinned under the navbar at the top of the
 * hero. Presentational only: Hero owns the platform_settings read so it can
 * reserve matching space, and renders this nothing when the promo is over.
 */
const PromoTicker: React.FC<PromoTickerProps> = ({ endsOn }) => {
  // Rendered twice inside a w-max track; the marquee keyframe shifts the track
  // by exactly half its width, so the loop has no visible seam.
  const Message = () => (
    <span className="flex shrink-0 items-center gap-3 whitespace-nowrap px-4 text-[10px] uppercase tracking-[0.2em] sm:text-[11px]">
      <span className="font-semibold text-accent">For a limited time</span>
      <span className="text-paper/85">
        Clients get complimentary 30-minute sessions with our exclusive Personal Trainer selection
      </span>
      <span className="text-paper/30">/</span>
      <span className="text-paper/85">
        Founding Certified Personal Trainers get 12 months fee-free from their first session
      </span>
      <span className="font-semibold text-accent">Ends {endsOn}</span>
      <span className="px-4 text-accent/50">&bull;</span>
    </span>
  );

  return (
    <div className="absolute inset-x-0 top-20 z-20 overflow-hidden border-y border-accent/25 bg-ink">
      <div className="flex w-max animate-marquee py-2.5 motion-reduce:animate-none">
        <Message />
        {/* Duplicate is purely visual filler for the loop, so it is not announced. */}
        <div aria-hidden="true" className="flex">
          <Message />
        </div>
      </div>
    </div>
  );
};

export default PromoTicker;
