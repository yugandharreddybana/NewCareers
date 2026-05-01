/**
 * Task 141b — SkeletonCard
 * Animated pulse skeleton that matches JobCard proportions.
 * Used in Dashboard, Kanban, and any other grid/list that loads JobCards.
 *
 * Usage:
 *   {loading && [...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
 */
export default function SkeletonCard() {
  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl p-5
                 flex flex-col gap-3 animate-pulse"
    >
      {/* Top row: company badge + source tag */}
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-xl bg-slate-100" />
        <div className="w-16 h-5 rounded-full bg-slate-100" />
      </div>

      {/* Title */}
      <div className="space-y-2">
        <div className="h-4 w-3/4 rounded-lg bg-slate-100" />
        <div className="h-3 w-1/2 rounded-lg bg-slate-100" />
      </div>

      {/* Match bar */}
      <div className="h-2 w-full rounded-full bg-slate-100" />
      <div className="flex justify-between">
        <div className="h-3 w-10 rounded bg-slate-100" />
        <div className="h-3 w-10 rounded bg-slate-100" />
      </div>

      {/* Skill chips */}
      <div className="flex gap-2 mt-1">
        <div className="h-6 w-14 rounded-lg bg-slate-100" />
        <div className="h-6 w-16 rounded-lg bg-slate-100" />
        <div className="h-6 w-12 rounded-lg bg-slate-100" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <div className="h-3 w-20 rounded bg-slate-100" />
        <div className="h-8 w-24 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}
