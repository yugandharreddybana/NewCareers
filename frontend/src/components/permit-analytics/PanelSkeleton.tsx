export function PanelSkeleton({ className = 'h-48' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 ${className}`} />
  );
}

export function CardSkeleton() {
  return <div className="animate-pulse h-28 rounded-xl bg-slate-100" />;
}
