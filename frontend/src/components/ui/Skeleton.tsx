import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?:  string | number;
  height?: string | number;
  circle?: boolean;
}

export function Skeleton({ className, width, height, circle, style, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton animate-pulse', circle ? 'rounded-full' : 'rounded-lg', className)}
      style={{ width, height, ...style }}
      {...props}
    />
  );
}

export function JobCardSkeleton() {
  return (
    <div className="bg-white border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton width={44} height={44} circle />
        <div className="flex-1 space-y-2">
          <Skeleton height={16} className="w-3/4" />
          <Skeleton height={13} className="w-1/2" />
        </div>
        <Skeleton width={52} height={24} className="rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton height={22} className="w-20 rounded-full" />
        <Skeleton height={22} className="w-16 rounded-full" />
        <Skeleton height={22} className="w-24 rounded-full" />
      </div>
      <Skeleton height={5} className="w-full rounded-full" />
    </div>
  );
}

export function SkillPanelSkeleton() {
  return (
    <div className="bg-white border border-border rounded-xl p-6 space-y-4">
      <Skeleton height={18} className="w-1/3" />
      <div className="space-y-2">
        <Skeleton height={13} className="w-full" />
        <Skeleton height={13} className="w-5/6" />
        <Skeleton height={13} className="w-4/6" />
      </div>
      <div className="flex gap-3 pt-1">
        <Skeleton height={36} className="flex-1 rounded-xl" />
        <Skeleton height={36} className="flex-1 rounded-xl" />
      </div>
    </div>
  );
}

export function StatRowSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[0, 1, 2].map(i => (
        <div key={i} className="bg-white border border-border rounded-xl p-4 space-y-2">
          <Skeleton height={12} className="w-2/3" />
          <Skeleton height={28} className="w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
