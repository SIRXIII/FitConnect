import { SkeletonRect, SkeletonLine } from '@/components/shared/Skeleton';

export const ProfileSkeleton: React.FC = () => (
  <div className="min-h-screen bg-paper pt-28 pb-20">
    <div className="max-w-6xl mx-auto px-6">
      <SkeletonLine width="w-32" className="h-4 mb-12" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-8">
          <SkeletonRect className="aspect-[4/5] w-full" />
          <div className="space-y-4 border border-ink/10 p-6">
            <SkeletonLine width="w-full" className="h-4" />
            <SkeletonLine width="w-full" className="h-4" />
            <SkeletonLine width="w-full" className="h-4" />
          </div>
        </div>
        {/* Right column */}
        <div className="lg:col-span-2 space-y-12">
          <div className="space-y-4">
            <SkeletonLine width="w-48" className="h-8" />
            <SkeletonLine width="w-32" className="h-4" />
          </div>
          <SkeletonRect className="h-24 w-full" />
          <div className="grid grid-cols-3 gap-4">
            <SkeletonRect className="h-16" />
            <SkeletonRect className="h-16" />
            <SkeletonRect className="h-16" />
          </div>
        </div>
      </div>
    </div>
  </div>
);
