import { Skeleton } from './Skeleton';

/**
 * Task 141b — SkeletonCard
 * Shared shimmer skeleton that matches JobCard proportions.
 * Used in Dashboard, Kanban, and any other grid/list that loads JobCards.
 *
 * Usage:
 *   {loading && [...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
 */
export default function SkeletonCard() {
  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl p-5
                 flex flex-col gap-3"
    >
      {/* Top row: company badge + source tag */}
      <div className="flex items-center justify-between">
        <Skeleton className="w-9 h-9" rounded="lg" />
        <Skeleton className="w-16 h-5" rounded="full" />
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>

      {/* Match bar */}
      <Skeleton className="h-2 w-full" rounded="full" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-10" rounded="sm" />
        <Skeleton className="h-3 w-10" rounded="sm" />
      </div>

      {/* Skill chips */}
      <div className="flex gap-2 mt-1">
        <Skeleton className="h-6 w-14" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-12" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <Skeleton className="h-3 w-20" rounded="sm" />
        <Skeleton className="h-8 w-24" rounded="lg" />
      </div>
    </div>
  );
}

SkeletonCard.displayName = 'SkeletonCard';
