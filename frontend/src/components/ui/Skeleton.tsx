import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

export function Skeleton({ className, width, height, rounded = 'md', style, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton', {
        'rounded-sm':   rounded === 'sm',
        'rounded-md':   rounded === 'md',
        'rounded-lg':   rounded === 'lg',
        'rounded-full': rounded === 'full',
      }, className)}
      style={{ width, height, ...style }}
      {...props}
    />
  );
}

export function JobCardSkeleton() {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton width={40} height={40} rounded="lg" />
        <div className="flex-1 space-y-2">
          <Skeleton height={16} className="w-3/4" />
          <Skeleton height={12} className="w-1/2" />
        </div>
        <Skeleton width={48} height={48} rounded="full" />
      </div>
      <div className="flex gap-2">
        <Skeleton height={24} className="w-20" rounded="md" />
        <Skeleton height={24} className="w-16" rounded="md" />
        <Skeleton height={24} className="w-24" rounded="md" />
      </div>
      <Skeleton height={12} className="w-full" />
      <Skeleton height={12} className="w-2/3" />
    </div>
  );
}

export function StatRowSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card p-4 space-y-2">
          <Skeleton height={12} className="w-16" />
          <Skeleton height={28} className="w-12" />
        </div>
      ))}
    </div>
  );
}

export function KanbanCardSkeleton() {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton height={14} className="w-4/5" />
      <Skeleton height={12} className="w-3/5" />
      <div className="flex gap-2">
        <Skeleton height={20} className="w-14" rounded="md" />
        <Skeleton height={20} className="w-16" rounded="md" />
      </div>
    </div>
  );
}

export default Skeleton;
