import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { jobsApi, skillsApi } from '@/services/api';
import { JobCard, JobsListResponse, Stats } from '@/types';
import JobCardUI from '@/components/ui/JobCard';
import SkillButton from '@/components/skills/SkillButton';
import { useSkill } from '@/components/skills/useSkill';
import ComparePanel from '@/components/skills/ComparePanel';
import TriagePanel from '@/components/skills/TriagePanel';
import {
  Sparkles, Target, Zap, ChevronRight, Search,
  Briefcase, Send, Users, TrendingUp, AlertTriangle, X, SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Source options derived from the colour map in JobCard.tsx ──
const SOURCE_OPTIONS = [
  'All Sources',
  'LinkedIn (Twin AI)',
  'IrishJobs',
  'Jobs.ie',
  'Reed',
  'Adzuna',
  'Remotive',
  'TheMuse',
  'Jobicy',
];

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData]     = useState<JobsListResponse | null>(null);
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [fetching, setFetching] = useState(false);

  // ── Filter state ────────────────────────────────────────────────
  const [search, setSearch]         = useState('');
  const [sourceFilter, setSource]   = useState('All Sources');
  const [minMatch, setMinMatch]     = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const compareSkill = useSkill(useCallback(async () => {
    const ids = (data?.items || []).slice(0, 5).map(j => j.userJobId);
    return skillsApi.compare(ids);
  }, [data]));

  const triageSkill = useSkill(useCallback(() => skillsApi.triage(), []));

  async function load() {
    try {
      const [res, s] = await Promise.all([jobsApi.list(), jobsApi.stats()]);
      setData(res);
      setStats(s);
    } catch (e: any) { toast.error(e.normalizedMessage || 'Failed to load jobs'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function getMore() {
    if (!data || data.remaining <= 0) return;
    setFetching(true);
    try {
      const summary = await jobsApi.fetch(Math.min(5, data.remaining));
      toast.success(`${summary.delivered} new job${summary.delivered !== 1 ? 's' : ''} added`);
      await load();
    } catch (e: any) { toast.error(e.normalizedMessage || 'Fetch failed'); }
    finally { setFetching(false); }
  }

  const allJobs: JobCard[] = data?.items || [];

  // ── Client-side filtering ────────────────────────────────────────
  const filteredJobs = useMemo(() => {
    return allJobs.filter(j => {
      if (minMatch > 0 && (j.matchPercent ?? 0) < minMatch) return false;
      if (sourceFilter !== 'All Sources' && j.sourceName && !j.sourceName.toLowerCase().includes(sourceFilter.toLowerCase())) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!j.title.toLowerCase().includes(q) && !j.company.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allJobs, search, sourceFilter, minMatch]);

  const topJobs = filteredJobs
    .filter(j => j.kanbanColumn === 'Discovered' || j.kanbanColumn === 'Saved')
    .slice(0, 9);

  // ── CV Skills gap banner: aggregate top missing skills across all jobs ───
  const missingSkillsMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const j of allJobs) {
      for (const s of j.unmatchedSkills || []) {
        map[s] = (map[s] || 0) + 1;
      }
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .filter(([, count]) => count >= 2);
  }, [allJobs]);

  const activeFilters = search || sourceFilter !== 'All Sources' || minMatch > 0;

  return (
    <div className="space-y-8 pb-20">

      {/* ── Hero / Header ─────────────────────────────────────────── */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-2"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-vibrant/10 text-brand-vibrant text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles size={14} />
            <span>AI Powered Matches</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
            Your Top <span className="gradient-text">Matches</span>
          </h1>
          {data && (
            <div className="flex items-center gap-3 text-slate-500">
              <p className="text-sm">
                Daily quota: <span className="font-bold text-slate-900">{data.dailyCount}</span> of <span className="text-slate-900 font-medium">{data.dailyLimit}</span>
              </p>
              <div className="h-1 w-24 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(data.dailyCount / data.dailyLimit) * 100}%` }}
                  className="h-full bg-brand-vibrant"
                />
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex gap-3"
        >
          <SkillButton
            label="Compare Matches"
            icon={<Target size={18} className="mr-2" />}
            state={topJobs.length < 2 ? 'locked' : compareSkill.state}
            onClick={compareSkill.run}
            className="!rounded-2xl shadow-lg"
          />
          <SkillButton
            label="Triage Queue"
            icon={<Zap size={18} className="mr-2" />}
            state={allJobs.length === 0 ? 'locked' : triageSkill.state}
            onClick={triageSkill.run}
            className="!rounded-2xl shadow-lg"
          />
        </motion.div>
      </section>

      {/* ── Stats Bar ─────────────────────────────────────────────── */}
      {stats && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <StatBox icon={<Briefcase size={20} />} label="Total Matched" value={stats.total} color="brand" />
          <StatBox icon={<Send size={20} />}      label="Applied"       value={stats.applied} color="blue" />
          <StatBox icon={<Users size={20} />}     label="Interviews"    value={stats.interviews} color="emerald" />
          <StatBox
            icon={<TrendingUp size={20} />}
            label="Avg Match"
            value={stats.avgMatch ? `${Math.round(stats.avgMatch)}%` : '—'}
            color="violet"
          />
        </motion.section>
      )}

      {/* ── CV Skills Gap Banner ───────────────────────────────────── */}
      <AnimatePresence>
        {missingSkillsMap.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card px-5 py-4 border-l-4 border-l-amber-400 flex items-start gap-4"
          >
            <AlertTriangle size={20} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 mb-1.5">
                Your CV is missing skills that appear in {missingSkillsMap[0][1]}+ of your top matches
              </p>
              <div className="flex flex-wrap gap-2">
                {missingSkillsMap.map(([skill, count]) => (
                  <span key={skill} className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                    {skill} <span className="opacity-60">×{count}</span>
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-slate-400 font-medium shrink-0 hidden md:block">
              Add these to your CV to improve scores
            </p>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── Filter Bar ────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title or company…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 h-11 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-brand-vibrant/50 focus:ring-2 focus:ring-brand-vibrant/10 transition-all shadow-sm"
            />
          </div>

          {/* Toggle advanced filters */}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`h-11 px-4 rounded-2xl border text-sm font-bold flex items-center gap-2 transition-all shadow-sm ${
              showFilters || activeFilters
                ? 'bg-brand-vibrant text-white border-brand-vibrant'
                : 'bg-white text-slate-500 border-slate-200 hover:border-brand-vibrant/30'
            }`}
          >
            <SlidersHorizontal size={15} />
            Filters
            {activeFilters && !showFilters && (
              <span className="w-2 h-2 rounded-full bg-white/80 inline-block" />
            )}
          </button>
        </div>

        {/* Advanced filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="glass-card p-5 flex flex-col md:flex-row gap-5 items-start md:items-center">
                {/* Source */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Source</label>
                  <select
                    value={sourceFilter}
                    onChange={e => setSource(e.target.value)}
                    className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 focus:outline-none focus:border-brand-vibrant/50 cursor-pointer"
                  >
                    {SOURCE_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>

                {/* Min match */}
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Min Match: <span className="text-brand-vibrant">{minMatch > 0 ? `${minMatch}%` : 'Any'}</span>
                  </label>
                  <input
                    type="range" min={0} max={100} step={5}
                    value={minMatch}
                    onChange={e => setMinMatch(Number(e.target.value))}
                    className="w-full accent-brand-vibrant"
                  />
                </div>

                {/* Clear */}
                {activeFilters && (
                  <button
                    onClick={() => { setSearch(''); setSource('All Sources'); setMinMatch(0); }}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X size={14} /> Clear all
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Job Grid ──────────────────────────────────────────────── */}
      <section>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="glass-card p-6 h-64 animate-pulse" />
            ))}
          </div>
        ) : topJobs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-20 text-center flex flex-col items-center max-w-2xl mx-auto"
          >
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <Search className="text-slate-300" size={40} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              {activeFilters ? 'No jobs match your filters' : 'No matches found yet'}
            </h3>
            <p className="text-slate-500 mb-8 max-w-md">
              {activeFilters
                ? 'Try loosening the filters above to see more results.'
                : "We haven't found any jobs matching your profile today. Click below to fetch new opportunities."}
            </p>
            {!activeFilters && (
              <button
                className="btn btn-primary px-8 py-4 !rounded-2xl"
                disabled={fetching}
                onClick={getMore}
              >
                {fetching ? 'Searching...' : 'Scan for New Jobs'}
                <ChevronRight size={20} />
              </button>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topJobs.map((j, idx) => (
              <motion.div
                key={j.userJobId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
              >
                <JobCardUI job={j} />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* ── Load More ─────────────────────────────────────────────── */}
      {data && data.remaining > 0 && topJobs.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center pt-8"
        >
          <button
            className="group btn btn-secondary px-10 py-4 !rounded-2xl gap-3 border-2 border-transparent hover:border-brand-vibrant/20"
            disabled={fetching}
            onClick={getMore}
          >
            <div className="w-8 h-8 rounded-lg bg-brand-vibrant/10 flex items-center justify-center text-brand-vibrant group-hover:scale-110 transition-transform">
              <Search size={18} />
            </div>
            <span className="font-bold">
              {fetching ? 'Fetching Opportunities...' : `Discover ${data.remaining} More Jobs`}
            </span>
          </button>
        </motion.div>
      )}

      {/* ── AI Panels ─────────────────────────────────────────────── */}
      <ComparePanel
        data={compareSkill.data}
        open={compareSkill.open}
        onClose={() => compareSkill.setOpen(false)}
        jobIds={topJobs.map(j => j.userJobId)}
      />
      <TriagePanel
        data={triageSkill.data}
        open={triageSkill.open}
        onClose={() => triageSkill.setOpen(false)}
      />
    </div>
  );
}

// ── Stat Box sub-component ────────────────────────────────────────
const COLOR_MAP: Record<string, { bg: string; icon: string; border: string }> = {
  brand:   { bg: 'bg-brand-vibrant/5',   icon: 'text-brand-vibrant', border: 'border-brand-vibrant/15' },
  blue:    { bg: 'bg-blue-50',           icon: 'text-blue-500',      border: 'border-blue-100' },
  emerald: { bg: 'bg-emerald-50',        icon: 'text-emerald-500',   border: 'border-emerald-100' },
  violet:  { bg: 'bg-violet-50',         icon: 'text-violet-500',    border: 'border-violet-100' },
};

function StatBox({
  icon, label, value, color
}: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  const c = COLOR_MAP[color] || COLOR_MAP.brand;
  return (
    <div className={`glass-card px-5 py-4 flex items-center gap-4 border ${c.border}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.bg} ${c.icon} shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-black text-slate-900 leading-tight">{value ?? '—'}</p>
      </div>
    </div>
  );
}
