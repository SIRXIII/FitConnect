import { SkeletonCircle, SkeletonLine } from '@/components/shared/Skeleton';

export const BookingCardSkeleton: React.FC = () => (
  <div className="border border-ink/10 p-6">
    <div className="flex items-center gap-4">
      <SkeletonCircle size="w-12 h-12" />
      <div className="space-y-2">
        <SkeletonLine width="w-40" className="h-5" />
        <SkeletonLine width="w-24" className="h-3" />
        <SkeletonLine width="w-32" className="h-3" />
      </div>
    </div>
  </div>
);
