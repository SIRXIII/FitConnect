import { MapPin } from 'lucide-react';
import { useLookingNow } from '@/hooks/useLookingNow';

export const LookingNowToggle: React.FC = () => {
  // Graceful degradation: render nothing if geolocation is not supported
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }

  return <LookingNowToggleInner />;
};

const LookingNowToggleInner: React.FC = () => {
  const { isActive, livePosition, activate, deactivate } = useLookingNow();

  const handleClick = () => {
    if (isActive) {
      deactivate();
    } else {
      activate();
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center gap-2 px-3 py-2 border text-[10px] uppercase tracking-[0.15em] font-medium transition-all duration-200 ${
          isActive
            ? 'border-accent text-accent bg-accent/5 hover:bg-accent/10'
            : 'border-ink/15 text-ink/50 hover:text-ink hover:border-ink/30'
        }`}
        title={isActive ? 'Click to stop sharing location' : 'Click to share your location for live trainer alerts'}
      >
        {isActive ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            Looking Now
          </>
        ) : (
          <>
            <MapPin size={12} />
            Looking Now
          </>
        )}
      </button>
      {isActive && livePosition && (
        <p className="text-[9px] text-ink/30 tracking-[0.1em]">Using your location</p>
      )}
    </div>
  );
};

export default LookingNowToggle;
