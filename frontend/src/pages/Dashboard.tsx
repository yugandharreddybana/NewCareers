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
  RotateCw, Search, SlidersHorizontal, X,
  Target, Zap, AlertTriangle, Building2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Source filter options
const SOURCE_OPTIONS = [
  'All Sources', 'LinkedIn (Twin AI)', 'IrishJobs',
  'Jobs.ie', 'Reed', 'Adzuna', 'Remotive', 'TheMuse', 'Jobicy',
];

export default function Dashboard() {
  const { user } = useAuth();
  const [data,     setData]     = useState<JobsListResponse | null>(null);
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [fetching, setFetching] = useState(false);

  // Filters
  const [search,      setSearch]      = useState('');
  const [sourceFilter, setSource]     = useState('All Sources');
  const [minMatch,    setMinMatch]    = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // AI skill hooks — unchanged from Phase 1
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
    } catch (e: any) {
      toast.error(e.normalizedMessage || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function getMore() {
    if (!data || data.remaining <= 0) return;
    setFetching(true);
    try {
      const summary = await jobsApi.fetch(Math.min(5, data.remaining));
      toast.success(`${summary.delivered} new job${summary.delivered !== 1 ? 's' : ''} added`);
      await load();
    } catch (e: any) {
      toast.error(e.normalizedMessage || 'Fetch failed');
    } finally {
      setFetching(false);
    }
  }

  const allJobs: JobCard[] = data?.items || [];

  // Client-side filtering — unchanged
  const filteredJobs = useMemo(() => {
    return allJobs.filter(j => {
      if (minMatch > 0 && (j.matchPercent ?? 0) < minMatch) return false;
      if (sourceFilter !== 'All Sources' && j.sourceName &&
          !j.sourceName.toLowerCase().includes(sourceFilter.toLowerCase())) return false;
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

  // CV skills gap aggregate — unchanged
  const missingSkillsMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const j of allJobs) {
      for (const s of j.unmatchedSkills || []) { map[s] = (map[s] || 0) + 1; }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).filter(([, c]) => c >= 2);
  }, [allJobs]);

  const activeFilters = search || sourceFilter !== 'All Sources' || minMatch > 0;

  return (
    <div className="space-y-8 pb-20">

      {/* ── Page header ── */}
      <section className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">Your Daily Mission</h1>
          <p className="text-slate-400 text-sm mt-1">What should you focus on today?</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* AI skill buttons — kept from Phase 1 */}
          <SkillButton
            label="Compare"
            icon={<Target size={15} className="mr-1.5" />}
            state={topJobs.length < 2 ? 'locked' : compareSkill.state}
            onClick={compareSkill.run}
            className="!rounded-xl !h-9 !text-xs"
          />
          <SkillButton
            label="Triage"
            icon={<Zap size={15} className="mr-1.5" />}
            state={allJobs.length === 0 ? 'locked' : triageSkill.state}
            onClick={triageSkill.run}
            className="!rounded-xl !h-9 !text-xs"
          />
          {/* Scan For New Jobs — the primary green CTA */}
          <button
            onClick={getMore}
            disabled={fetching || (data ? data.remaining <= 0 : false)}
            className="flex items-center gap-2 h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 shadow-sm"
          >
            <RotateCw size={14} className={fetching ? 'animate-spin' : ''} />
            {fetching ? 'Scanning…' : 'Scan For New Jobs'}
          </button>
        </div>
      </section>

      {/* ── CV Skills Gap Banner ── */}
      <AnimatePresence>
        {missingSkillsMap.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-4"
          >
            <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900 mb-2">
                Your CV is missing skills that appear in {missingSkillsMap[0][1]}+ of your top matches
              </p>
              <div className="flex flex-wrap gap-2">
                {missingSkillsMap.map(([skill, count]) => (
                  <span key={skill} className="px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold">
                    {skill} <span className="opacity-50">×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── Top Targeted Matches section ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Top Targeted Matches</h2>
          {data && data.dailyCount > 0 && (
            <span className="text-xs text-slate-400">
              {data.dailyCount} / {data.dailyLimit} today
            </span>
          )}
        </div>
        <div className="h-px bg-slate-200 mb-5" />

        {/* ── Filter bar ── */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by title or company…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 h-10 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
              />
            </div>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={[
                'h-10 px-3.5 rounded-xl border text-sm font-semibold flex items-center gap-1.5 transition-all',
                showFilters || activeFilters
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300',
              ].join(' ')}
            >
              <SlidersHorizontal size={14} />
              Filters
              {activeFilters && !showFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
              )}
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Source</label>
                    <select
                      value={sourceFilter}
                      onChange={e => setSource(e.target.value)}
                      className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 focus:outline-none focus:border-emerald-400 cursor-pointer"
                    >
                      {SOURCE_OPTIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Min Match: <span className="text-emerald-600">{minMatch > 0 ? `${minMatch}%` : 'Any'}</span>
                    </label>
                    <input
                      type="range" min={0} max={100} step={5}
                      value={minMatch}
                      onChange={e => setMinMatch(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                  {activeFilters && (
                    <button
                      onClick={() => { setSearch(''); setSource('All Sources'); setMinMatch(0); }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <X size={13} /> Clear all
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Job grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-56 bg-white border border-slate-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : topJobs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-5">
              <Building2 size={28} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">
              {activeFilters ? 'No jobs match your filters' : 'No matches found in database'}
            </h3>
            <p className="text-sm text-slate-400 mb-6 max-w-sm">
              {activeFilters
                ? 'Try loosening the filters above to see more results.'
                : "You haven't scanned the market since creating your profile."}
            </p>
            {!activeFilters && (
              <button
                onClick={getMore}
                disabled={fetching}
                className="px-7 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {fetching ? 'Scanning…' : 'Scan the Market Now'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {topJobs.map((j, idx) => (
              <motion.div
                key={j.userJobId}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <JobCardUI job={j} />
              </motion.div>
            ))}
          </div>
        )}

        {/* Load more */}
        {data && data.remaining > 0 && topJobs.length > 0 && (
          <div className="flex justify-center mt-8">
            <button
              onClick={getMore}
              disabled={fetching}
              className="px-8 py-3 bg-white border border-slate-200 rounded-xl font-semibold text-sm text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition-all disabled:opacity-50"
            >
              {fetching ? 'Fetching…' : `Discover ${data.remaining} More Jobs`}
            </button>
          </div>
        )}
      </section>

      {/* ── Market Pulse ── */}
      <section>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Card header */}
          <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Building2 size={14} className="text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-800">Market Pulse</h3>
          </div>

          {/* Three stats columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {/* Sourced jobs */}
            <div className="px-6 py-5 space-y-1">
              <p className="text-3xl font-black text-slate-900">{stats?.total ?? 0}</p>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Sourced Jobs</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Total high-match roles curated into your pipeline historically.
              </p>
            </div>

            {/* Active region */}
            <div className="px-6 py-5 space-y-1">
              <p className="text-3xl font-black text-slate-900">Ireland</p>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Active Region</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scanning jobs filtered for local and EMEA distributed zones.
              </p>
            </div>

            {/* Engine status */}
            <div className="px-6 py-5 space-y-1">
              <p className="text-3xl font-black text-emerald-500">Live</p>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Engine Status</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your profile, CV, and preferences are fully indexed for scraping.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── AI panels (unchanged) ── */}
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
