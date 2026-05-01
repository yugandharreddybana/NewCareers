/**
 * Section 7 — Task 75
 * RecommendedJobsWidget
 *
 * Section 3.3 fix: wired "View All" button to navigate to
 * /kanban?column=Discovered instead of being a no-op.
 *
 * Horizontally scrollable strip of up to 5 recommended jobs.
 * Each card shows: title, company, location, match %, salary (if available),
 * and a coloured "whyRecommended" chip explaining the recommendation reason.
 *
 * Empty / loading states included.
 * Clicking a card navigates to the job detail page.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, MapPin, Building2, ChevronRight } from 'lucide-react';
import { discoveryApi, RecommendedJob } from '@/services/discoveryApi';

// ── Chip colour by recommendation reason ─────────────────────────────────

function chipClass(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes('exceptional')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (r.includes('strong'))      return 'bg-indigo-100  text-indigo-700  border-indigo-200';
  if (r.includes('top skill'))   return 'bg-violet-100  text-violet-700  border-violet-200';
  return                                'bg-slate-100   text-slate-600   border-slate-200';
}

// ── Single card ────────────────────────────────────────────────────────────

function RecommendedCard({ job, index }: { job: RecommendedJob; index: number }) {
  const nav = useNavigate();

  const salary =
    job.salaryMin && job.salaryMax
      ? `${job.currency ?? '€'}${(job.salaryMin / 1000).toFixed(0)}k–${(job.salaryMax / 1000).toFixed(0)}k`
      : job.salaryMin
      ? `${job.currency ?? '€'}${(job.salaryMin / 1000).toFixed(0)}k+`
      : null;

  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={() => nav(`/jobs/${job.userJobId}`)}
      className="group shrink-0 w-64 bg-white border border-slate-200 rounded-2xl p-4
                 flex flex-col gap-3 text-left hover:border-indigo-300 hover:shadow-md
                 transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0
                        group-hover:bg-indigo-50 transition-colors">
          <Building2 size={16} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
        </div>
        <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-50 border
                         border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
          {job.matchPercent}%
        </span>
      </div>

      {/* Job info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
          {job.title}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{job.company}</p>
      </div>

      {/* Location + salary */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <MapPin size={11} className="shrink-0" />
        <span className="truncate">{job.location}</span>
        {salary && (
          <>
            <span className="text-slate-200">·</span>
            <span className="text-slate-500 font-medium shrink-0">{salary}</span>
          </>
        )}
      </div>

      {/* Why recommended chip */}
      <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold
                       leading-tight truncate ${chipClass(job.whyRecommended)}`}>
        ✨ {job.whyRecommended}
      </div>
    </motion.button>
  );
}

// ── Widget ─────────────────────────────────────────────────────────────────

export default function RecommendedJobsWidget() {
  const nav = useNavigate();
  const [jobs,    setJobs]    = useState<RecommendedJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    discoveryApi.getRecommended()
      .then(setJobs)
      .catch(() => { /* silently hide widget on error */ })
      .finally(() => setLoading(false));
  }, []);

  // Hide entirely if no data and not loading
  if (!loading && jobs.length === 0) return null;

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Sparkles size={14} className="text-indigo-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-800">Recommended For You</h2>
        </div>
        <span className="text-xs text-slate-400">Based on your profile &amp; activity</span>
      </div>

      {/* Horizontal scroll strip */}
      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {[...Array(3)].map((_, i) => (
            <div key={i}
              className="shrink-0 w-64 h-44 bg-white border border-slate-200
                         rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2
                        scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {jobs.map((job, idx) => (
            <RecommendedCard key={String(job.userJobId)} job={job} index={idx} />
          ))}

          {/* View All pill — navigates to Kanban board filtered to Discovered column */}
          <button
            onClick={() => nav('/kanban?column=Discovered')}
            className="shrink-0 w-20 h-full min-h-[10rem] bg-slate-50 border border-dashed
                       border-slate-200 rounded-2xl flex flex-col items-center justify-center
                       gap-2 text-slate-400 hover:text-indigo-500 hover:border-indigo-300
                       transition-all group"
          >
            <ChevronRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
            <span className="text-[10px] font-semibold">View all</span>
          </button>
        </div>
      )}
    </section>
  );
}
