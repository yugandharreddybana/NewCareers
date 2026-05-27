/**
 * Section 7 ΓÇö Task 77
 * Dashboard wired with:
 *   - JobSearchBar (above job grid) ΓÇö calls discoveryApi.search() on submit
 *   - RecommendedJobsWidget (below job grid) ΓÇö always visible when data exists
 *   - PlannerWidget (sidebar) ΓÇö shows overdue badge, upcoming deadlines & tasks
 *   - JobPlannerPanel (slide-over drawer) ΓÇö opens when PlannerWidget item clicked
 *
 * Section 3.3 fix: added lastSearchParams state + search pagination controls.
 *
 * Mobile audit (task 133): header action buttons wrap on 375px, stats col=1,
 * no horizontal overflow.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PageMeta } from '@/components/PageMeta';
import { discoveryApi, SearchParams, SearchResult } from '@/services/discoveryApi';
import { queryKeys } from '@/lib/queryKeys';
import {
  useJobsList,
  useFetchLiveJobMutation,
  useFetchMoreJobsMutation,
  useAnalyticsSummary,
} from '@/hooks/queries';
import { skillsApi } from '@/services/skillsApi';
import { isApiError, JobCard, JobsListResponse } from '@/types';
import { isCompareData, isTriageData, type CompareData, type TriageData } from '@/types/skills-data';
import JobCardUI from '@/components/ui/JobCard';
import SkillButton from '@/components/skills/SkillButton';
import { useQuickSkill as useSkill } from '@/components/skills/useQuickSkill';
import ComparePanel from '@/components/skills/ComparePanel';
import TriagePanel from '@/components/skills/TriagePanel';
import JobSearchBar from '@/components/discovery/JobSearchBar';
import RecommendedJobsWidget from '@/components/discovery/RecommendedJobsWidget';
import { PlannerWidget, JobPlannerPanel } from '@/components/planner';
import { ProductTour, DASHBOARD_TOUR_STEPS } from '@/components/onboarding/ProductTour';
import { FirstApplicationChecklist } from '@/components/onboarding/FirstApplicationChecklist';
import { ContextualHelpTip, HELP_TIPS } from '@/components/onboarding/ContextualHelpTip';
import {
  RotateCw, X, Sparkles,
  Target, Zap, AlertTriangle, Building2, Send, TrendingUp,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


const TOUR_KEY = 'careerops_dashboard_tour_done';

const EMPTY_JOBS: JobsListResponse = {
  items: [],
  remaining: 0,
  dailyCount: 0,
  dailyLimit: 15,
};

export default function PipelineDashboard() {
  const queryClient = useQueryClient();
  const { data: jobsData, isLoading: loading } = useJobsList();
  const data = jobsData ?? EMPTY_JOBS;
  const fetchMore = useFetchMoreJobsMutation();
  const fetchLive = useFetchLiveJobMutation();
  const { data: analyticsStats, isLoading: statsLoading } = useAnalyticsSummary();

  // Pipeline filters (existing)
  const [search] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [minMatch] = useState(0);

  // Salary range filter for pipeline
  const [pipelineMinSalary] = useState<number | undefined>(undefined);
  const [pipelineMaxSalary] = useState<number | undefined>(undefined);

  // ΓöÇΓöÇ Section 7: Search mode state ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const [searchResult,     setSearchResult]     = useState<SearchResult | null>(null);
  const [searching,        setSearching]        = useState(false);
  // Section 3.3: store last params so pagination can replay the same search
  const [lastSearchParams, setLastSearchParams] = useState<SearchParams>({});
  const isSearchMode = searchResult !== null;

  // ΓöÇΓöÇ Planner drawer state ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const [plannerJobId,    setPlannerJobId]    = useState<string | null>(null);
  const [plannerJobTitle, setPlannerJobTitle] = useState<string>('');
  const plannerOpen = plannerJobId !== null;

  // ΓöÇΓöÇ Section 3.6 Task 71: product tour ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const [tourActive, setTourActive] = useState(false);
  useEffect(() => {
    // Delay so page layout settles before measuring element positions
    if (!localStorage.getItem(TOUR_KEY)) {
      const t = setTimeout(() => setTourActive(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  function openPlannerForJob(userJobId: string) {
    const allJobs: JobCard[] = data?.items || [];
    const found = allJobs.find(j => j.userJobId === userJobId);
    setPlannerJobTitle(found?.title ?? 'Job');
    setPlannerJobId(userJobId);
  }

  const unwrapCompareData = (value: unknown): CompareData | null => {
    if (!isCompareData(value)) {
      throw new Error('Compare skill returned unexpected data.');
    }
    return value;
  };

  const unwrapTriageData = (value: unknown): TriageData | null => {
    if (!isTriageData(value)) {
      throw new Error('Triage skill returned unexpected data.');
    }
    return value;
  };

  // AI skill hooks
  const compareSkill = useSkill<CompareData | null>(useCallback(async () => {
    const ids = (data?.items || []).slice(0, 5).map(j => j.userJobId);
    const result = await skillsApi.compare(ids);
    return unwrapCompareData(result.data);
  }, [data]));
  const triageSkill = useSkill<TriageData | null>(useCallback(async () => {
    const result = await skillsApi.triage();
    return unwrapTriageData(result.data);
  }, []));

  async function getMore() {
    if (!data || data.remaining <= 0) return;
    try {
      const summary = await fetchMore.mutateAsync(Math.min(5, data.remaining));
      toast.success(`${summary.delivered} new job${summary.delivered !== 1 ? 's' : ''} added`);
    } catch (e) {
      toast.error(isApiError(e) ? e.normalizedMessage : 'Fetch failed');
    }
  }

  async function handleFetchLiveJobs() {
    try {
      const liveJob = await fetchLive.mutateAsync();
      toast.success(`Fetched: ${liveJob.title} at ${liveJob.company}!`);
    } catch (e) {
      toast.error(isApiError(e) ? e.normalizedMessage : 'Failed to fetch live jobs');
    }
  }

  // ΓöÇΓöÇ Section 7 + 3.3: handle search bar submit ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  async function handleSearch(params: SearchParams) {
    if (Object.keys(params).length === 0) {
      setSearchResult(null);
      setLastSearchParams({});
      return;
    }
    setLastSearchParams(params);
    setSearching(true);
    try {
      const result = await queryClient.fetchQuery({
        queryKey: queryKeys.discovery.search({ ...params, page: 0 }),
        queryFn: () => discoveryApi.search({ ...params, page: 0 }),
      });
      setSearchResult(result);
    } catch (e) {
      toast.error(isApiError(e) ? e.normalizedMessage : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  // ΓöÇΓöÇ Section 3.3: paginate search results ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  async function goToSearchPage(page: number) {
    if (!searchResult || page < 0 || page >= searchResult.totalPages) return;
    setSearching(true);
    try {
      const result = await queryClient.fetchQuery({
        queryKey: queryKeys.discovery.search({ ...lastSearchParams, page }),
        queryFn: () => discoveryApi.search({ ...lastSearchParams, page }),
      });
      setSearchResult(result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast.error(isApiError(e) ? e.normalizedMessage : 'Failed to load page');
    } finally {
      setSearching(false);
    }
  }

  // ΓöÇΓöÇ Pipeline jobs (existing filter logic + salary) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const allJobs: JobCard[] = data?.items || [];

  // Dynamically derive available source options from pipeline data
  const sourceOptions = useMemo(() => {
    const sources = new Set<string>();
    for (const j of allJobs) {
      if (j.sourceName) sources.add(j.sourceName.replace(/ Careers$/i, '').trim());
    }
    return ['All Sources', ...Array.from(sources).sort()];
  }, [allJobs]);

  const filteredJobs = useMemo(() => {
    return allJobs.filter(j => {
      if (minMatch > 0 && (j.matchPercent ?? 0) < minMatch) return false;
      if (sourceFilter !== 'All Sources' && j.sourceName &&
          !j.sourceName.toLowerCase().includes(sourceFilter.toLowerCase())) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!j.title.toLowerCase().includes(q) && !j.company.toLowerCase().includes(q)) return false;
      }
      if (pipelineMinSalary != null && j.salaryMax != null && j.salaryMax < pipelineMinSalary) return false;
      if (pipelineMaxSalary != null && j.salaryMin != null && j.salaryMin > pipelineMaxSalary) return false;
      return true;
    });
  }, [allJobs, search, sourceFilter, minMatch, pipelineMinSalary, pipelineMaxSalary]);

  const topJobs = filteredJobs
    .filter(j => j.kanbanColumn === 'Discovered' || j.kanbanColumn === 'Saved')
    .slice(0, 9);

  const missingSkillsMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const j of allJobs) {
      for (const s of j.unmatchedSkills || []) { map[s] = (map[s] || 0) + 1; }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).filter(([, c]) => c >= 2);
  }, [allJobs]);
  const topMissingSkillCount = missingSkillsMap[0]?.[1] ?? 0;

  const activeFilters = search || sourceFilter !== 'All Sources' || minMatch > 0
    || pipelineMinSalary != null || pipelineMaxSalary != null;

  const displayJobs: JobCard[] = isSearchMode
    ? (searchResult?.items ?? [])
    : topJobs;

  const currentPage  = searchResult?.page ?? 0;
  const totalPages   = searchResult?.totalPages ?? 1;
  const totalResults = searchResult?.total ?? 0;

  return (
    <div className="space-y-8 pb-20">
      <PageMeta title="Job pipeline" />

      {tourActive && (
        <ProductTour
          steps={DASHBOARD_TOUR_STEPS}
          onComplete={() => { localStorage.setItem(TOUR_KEY, '1'); setTourActive(false); }}
          onSkip={() => { localStorage.setItem(TOUR_KEY, '1'); setTourActive(false); }}
        />
      )}

      <FirstApplicationChecklist />

      <section className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">Your Daily Mission</h1>
          <p className="text-slate-400 text-sm mt-1">What should you focus on today?</p>
        </div>
        <div id="dashboard-skill-actions" className="flex flex-wrap items-center gap-2 shrink-0">
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
          <button
            onClick={handleFetchLiveJobs}
            disabled={fetchLive.isPending}
            className="flex items-center gap-2 h-9 px-4 bg-indigo-600 hover:bg-indigo-700
                       text-white rounded-xl font-semibold text-sm transition-all
                       disabled:opacity-50 shadow-sm"
          >
            <Sparkles size={14} className={fetchLive.isPending ? 'animate-spin' : ''} />
            {fetchLive.isPending ? 'Fetching…' : 'Fetch Live Jobs'}
          </button>
          <button
            onClick={getMore}
            disabled={fetchMore.isPending || (data ? data.remaining <= 0 : false)}
            className="flex items-center gap-2 h-9 px-4 bg-emerald-500 hover:bg-emerald-600
                       text-white rounded-xl font-semibold text-sm transition-all
                       disabled:opacity-50 shadow-sm"
          >
            <RotateCw size={14} className={fetchMore.isPending ? 'animate-spin' : ''} />
            {fetchMore.isPending ? 'ScanningΓÇª' : 'Scan For New Jobs'}
          </button>
        </div>
      </section>

      <AnimatePresence>
        {missingSkillsMap.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4
                       flex items-start gap-4"
          >
            <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900 mb-2">
                Your CV is missing skills that appear in {topMissingSkillCount}+ of your top matches
              </p>
              <div className="flex flex-wrap gap-2">
                {missingSkillsMap.map(([skill, count]) => (
                  <span key={skill}
                    className="px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-300
                               text-amber-800 text-xs font-semibold">
                    {skill} <span className="opacity-50">├ù{count}</span>
                  </span>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-8">
        <section className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">
              {isSearchMode
                ? `Search Results (${totalResults})`
                : 'Top Targeted Matches'}
            </h2>
            <div className="flex items-center gap-3">
              {isSearchMode && (
                <button
                  onClick={() => { setSearchResult(null); setLastSearchParams({}); }}
                  className="flex items-center gap-1.5 text-xs font-semibold
                             text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <X size={12} /> Clear search
                </button>
              )}
              {!isSearchMode && data && data.dailyCount > 0 && (
                <span className="text-xs text-slate-400">
                  {data.dailyCount} / {data.dailyLimit} today
                </span>
              )}
            </div>
          </div>
          <div className="h-px bg-slate-200 mb-5" />

          <div id="dashboard-search-bar" className="mb-6 flex items-center gap-4">
            <div className="flex-1">
              <JobSearchBar onSearch={handleSearch} loading={searching} />
            </div>
            {/* Show dropdown only when ≥2 distinct real sources exist ("All Sources" + ≥2 others) */}
            {!isSearchMode && sourceOptions.length > 2 && (
              <div className="flex items-center gap-2 shrink-0">
                <label htmlFor="source-filter" className="text-xs font-medium text-slate-500 whitespace-nowrap">
                  Source
                </label>
                <select
                  id="source-filter"
                  value={sourceFilter}
                  onChange={e => setSourceFilter(e.target.value)}
                  className="h-9 px-3 pr-8 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700
                             hover:border-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100
                             outline-none transition-all cursor-pointer appearance-none
                             bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]
                             bg-[length:12px] bg-[position:right_10px_center] bg-no-repeat"
                >
                  {sourceOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {loading || searching ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(3)].map((_, i) => (
                <div key={i}
                  className="h-56 bg-white border border-slate-200 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : displayJobs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-16
                            flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center
                              justify-center mb-5">
                <Building2 size={28} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">
                {isSearchMode ? 'No jobs match your search' :
                 activeFilters ? 'No jobs match your filters' :
                 'No matches found in database'}
              </h3>
              <p className="text-sm text-slate-400 mb-6 max-w-sm">
                {isSearchMode
                  ? 'Try different keywords, location, or remove salary filters.'
                  : activeFilters
                  ? 'Try loosening the filters above to see more results.'
                  : "You haven't scanned the market since creating your profile."}
              </p>
              {isSearchMode && (
                <button
                  onClick={() => { setSearchResult(null); setLastSearchParams({}); }}
                  className="px-7 py-3 bg-slate-900 text-white rounded-xl font-bold
                             text-sm hover:bg-slate-800 transition-all"
                >
                  Back to pipeline
                </button>
              )}
              {!isSearchMode && !activeFilters && (
                <button
                  onClick={getMore}
                  disabled={fetchMore.isPending}
                  className="px-7 py-3 bg-slate-900 text-white rounded-xl font-bold
                             text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  {fetchMore.isPending ? 'ScanningΓÇª' : 'Scan the Market Now'}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayJobs.map((j, idx) => (
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

          {isSearchMode && totalPages > 1 && (
            <div className="flex items-center justify-between mt-8 px-1">
              <button
                onClick={() => goToSearchPage(currentPage - 1)}
                disabled={searching || currentPage === 0}
                className="flex items-center gap-1.5 h-9 px-4 bg-white border border-slate-200
                           rounded-xl text-sm font-semibold text-slate-500
                           hover:border-emerald-300 hover:text-emerald-700
                           disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={15} /> Prev
              </button>
              <span className="text-xs text-slate-400 font-medium">
                Page <span className="text-slate-700 font-bold">{currentPage + 1}</span>
                {' '}of{' '}
                <span className="text-slate-700 font-bold">{totalPages}</span>
                <span className="text-slate-300 mx-1.5">┬╖</span>
                {totalResults} results
              </span>
              <button
                onClick={() => goToSearchPage(currentPage + 1)}
                disabled={searching || currentPage + 1 >= totalPages}
                className="flex items-center gap-1.5 h-9 px-4 bg-slate-900 text-white
                           rounded-xl text-sm font-semibold
                           hover:bg-slate-800
                           disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          )}

          {!isSearchMode && data && data.remaining > 0 && topJobs.length > 0 && (
            <div className="flex justify-center mt-8">
              <button
                onClick={getMore}
                disabled={fetchMore.isPending}
                className="px-8 py-3 bg-white border border-slate-200 rounded-xl font-semibold
                           text-sm text-slate-600 hover:border-emerald-300
                           hover:text-emerald-700 transition-all disabled:opacity-50"
              >
                {fetchMore.isPending ? 'FetchingΓÇª' : `Discover ${data.remaining} More Jobs`}
              </button>
            </div>
          )}
        </section>

        <aside id="dashboard-planner-card" className="w-full shrink-0">
          <PlannerWidget onOpenJob={openPlannerForJob} />
        </aside>
      </div>

      {!isSearchMode && <RecommendedJobsWidget />}

      <section>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
              <TrendingUp size={14} className="text-indigo-600" />
            </div>
            <h3 className="font-semibold text-slate-800">Your Progress This Week</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0
                          md:divide-x divide-slate-100">
            <div className="px-6 py-5 space-y-1">
              {statsLoading
                ? <div className="h-9 w-20 bg-slate-100 rounded animate-pulse mb-1" />
                : <p className="text-3xl font-black text-slate-900">
                    {analyticsStats?.skillsRunThisWeek ?? 0}
                  </p>}
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest
                            flex items-center gap-1.5">
                <Zap size={11} /> Skills Run This Week
                <ContextualHelpTip tip={HELP_TIPS.skillRun} placement="top" />
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                AI career tools used against jobs in your pipeline.
              </p>
            </div>
            <div className="px-6 py-5 space-y-1">
              {statsLoading
                ? <div className="h-9 w-16 bg-slate-100 rounded animate-pulse mb-1" />
                : <p className="text-3xl font-black text-slate-900">
                    {analyticsStats?.applicationsSubmitted ?? 0}
                  </p>}
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest
                            flex items-center gap-1.5">
                <Send size={11} /> Applications Submitted
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Jobs moved to Applied, Interview or Offer stage.
              </p>
            </div>
            <div className="px-6 py-5 space-y-1">
              {statsLoading
                ? <div className="h-9 w-20 bg-slate-100 rounded animate-pulse mb-1" />
                : <p className="text-3xl font-black text-emerald-500">
                    {analyticsStats?.avgMatchPercent ?? 0}%
                  </p>}
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest
                            flex items-center gap-1.5">
                <Target size={11} /> Avg Match Score
                <ContextualHelpTip tip={HELP_TIPS.matchScore} placement="top" />
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Average AI match quality across your full pipeline.
              </p>
            </div>
          </div>
        </div>
      </section>

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

      <AnimatePresence>
        {plannerOpen && (
          <>
            <motion.div
              key="planner-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setPlannerJobId(null)}
            />
            <motion.div
              key="planner-drawer"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50
                         flex flex-col overflow-hidden"
            >
              <JobPlannerPanel
                userJobId={plannerJobId!}
                jobTitle={plannerJobTitle}
                onClose={() => setPlannerJobId(null)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
