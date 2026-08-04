import React from 'react';

interface Props {
  pullDistance: number;
  refreshing: boolean;
  progress: number; // 0-1
}

/**
 * Minimal pull-to-refresh indicator matching FitRush design language.
 * Sits above the scrollable content; translateY drives it into view.
 */
const PullToRefreshIndicator: React.FC<Props> = ({ pullDistance, refreshing, progress }) => {
  const visible = pullDistance > 0 || refreshing;
  if (!visible) return null;

  return (
    <div
      className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
      style={{ height: `${pullDistance}px`, transition: refreshing ? 'height 0.2s ease' : 'none' }}
    >
      {refreshing ? (
        /* Spinner while fetching */
        <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      ) : (
        /* Arc that fills as user pulls */
        <div
          className="w-5 h-5 border-2 border-ink/15 rounded-full flex items-center justify-center"
          style={{ borderTopColor: progress >= 1 ? '#C5A059' : `rgba(26,26,26,${progress * 0.6})` }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full bg-accent transition-opacity"
            style={{ opacity: progress }}
          />
        </div>
      )}
    </div>
  );
};

export default PullToRefreshIndicator;
