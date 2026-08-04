import { SkeletonRect, SkeletonLine } from '@/components/shared/Skeleton';

export const TrainerCardSkeleton: React.FC = () => (
  <div className="space-y-6">
    <SkeletonRect className="aspect-[4/5] w-full" />
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <SkeletonLine width="w-36" className="h-6" />
          <SkeletonLine width="w-24" className="h-3" />
        </div>
        <SkeletonLine width="w-16" className="h-6" />
      </div>
      <SkeletonRect className="h-12 w-full" />
    </div>
  </div>
);
