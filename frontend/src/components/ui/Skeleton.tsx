import { cn } from '@/lib/utils';

type Rounded = 'sm' | 'md' | 'lg' | 'xl' | 'full';
const roundedMap: Record<Rounded, string> = {
  sm: 'rounded', md: 'rounded-lg', lg: 'rounded-xl', xl: 'rounded-2xl', full: 'rounded-full',
};

export function Skeleton({ className, rounded = 'md' }: { className?: string; rounded?: Rounded }) {
  return <div className={cn('shimmer', roundedMap[rounded], className)} />;
}

export function JobCardSkeleton() {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11" rounded="lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <Skeleton className="w-12 h-12" rounded="full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20" rounded="full" />
        <Skeleton className="h-5 w-16" rounded="full" />
        <Skeleton className="h-5 w-24" rounded="full" />
      </div>
      <Skeleton className="h-1.5 w-full" rounded="full" />
    </div>
  );
}

export function SkillPanelSkeleton() {
  return (
    <div className="card p-6 space-y-4">
      <Skeleton className="h-5 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    </div>
  );
}

export function KanbanCardSkeleton() {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-3 w-24" />
      <div className="flex gap-1.5">
        <Skeleton className="h-4 w-14" rounded="full" />
        <Skeleton className="h-4 w-14" rounded="full" />
      </div>
    </div>
  );
}

export function StatRowSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[0,1,2].map(i => (
        <div key={i} className="card p-5 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-14" />
          <Skeleton className="h-2 w-24" rounded="full" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
