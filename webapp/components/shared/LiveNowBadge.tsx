const LiveNowBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1">
    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
    <span className="text-[10px] uppercase tracking-[0.2em] text-green-600 font-medium">
      Live Now
    </span>
  </span>
);

export default LiveNowBadge;
