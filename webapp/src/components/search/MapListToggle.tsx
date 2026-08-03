interface MapListToggleProps {
  viewMode: 'list' | 'map';
  onChange: (mode: 'list' | 'map') => void;
}

export function MapListToggle({ viewMode, onChange }: MapListToggleProps) {
  return (
    <div
      className="inline-flex rounded-full border border-ink/10 p-0.5"
      style={{ minHeight: '44px', alignItems: 'center' }}
    >
      <button
        onClick={() => onChange('list')}
        className={`px-5 py-2 text-[10px] uppercase tracking-[0.2em] font-semibold rounded-full transition-all ${
          viewMode === 'list'
            ? 'bg-ink text-white'
            : 'text-ink/40 hover:text-ink/60'
        }`}
      >
        List
      </button>
      <button
        onClick={() => onChange('map')}
        className={`px-5 py-2 text-[10px] uppercase tracking-[0.2em] font-semibold rounded-full transition-all ${
          viewMode === 'map'
            ? 'bg-ink text-white'
            : 'text-ink/40 hover:text-ink/60'
        }`}
      >
        Map
      </button>
    </div>
  );
}
