export const SkeletonLine: React.FC<{ width?: string; className?: string }> = ({
  width = 'w-full',
  className = '',
}) => (
  <div className={`h-4 ${width} bg-ink/5 animate-pulse ${className}`} />
);

export const SkeletonCircle: React.FC<{ size?: string }> = ({ size = 'w-10 h-10' }) => (
  <div className={`${size} rounded-full bg-ink/5 animate-pulse`} />
);

export const SkeletonRect: React.FC<{ className?: string }> = ({ className = 'h-48 w-full' }) => (
  <div className={`bg-ink/5 animate-pulse ${className}`} />
);
