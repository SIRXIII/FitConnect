interface CountdownDisplayProps {
  display: string;
  onTap: () => void;
}

const CountdownDisplay: React.FC<CountdownDisplayProps> = ({ display, onTap }) => {
  if (!display) return null;

  return (
    <span
      aria-live="polite"
      className="text-[10px] uppercase tracking-[0.2em] font-medium text-ink/60 cursor-pointer tabular-nums"
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onTap()}
    >
      {display}
    </span>
  );
};

export default CountdownDisplay;
