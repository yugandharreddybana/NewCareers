/**
 * PipelineDashboard.tsx — production-hardened Batch 5
 *
 * Production fixes:
 *   D1 – feedRef typed as VirtualJobFeedHandle (not VariableSizeList) to match
 *        the decoupled forwardRef handle exposed by VirtualJobFeed.
 *   D2 – JobCard type has id: string via normalizeJobCard (mapped from
 *        userJobId), so it satisfies VirtualJobFeedItem constraint.
 *   D3 – renderCard stabilised with useCallback so VirtualJobFeed's itemData
 *        memo comparison holds across re-renders.
 *   D4 – Empty-state "Scan" button uses firstPage.remaining to decide
 *        disabled state (was data?.remaining which no longer exists on the
 *        infinite query shape).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getUserFacingErrorMessage } from '@/lib/userFacingError';
import { PageMeta } from '@/components/PageMeta';
import { discoveryApi, SearchParams, SearchResult } from '@/services/discoveryApi';
import { queryKeys } from '@/lib/queryKeys';
import {
  useFetchLiveJobMutation,
  useAnalyticsSummary,
  useInfiniteJobsFeed,
  useProfileQuery,
} from '@/hooks/queries';
import { fetchJobsOrchestrated } from '@/lib/pipelineJobSearch';
import { skillsApi } from '@/services/skillsApi';
import { JobCard } from '@/types';
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
import { VirtualJobFeed, type VirtualJobFeedHandle } from '@/components/jobs/VirtualJobFeed';
import { useScrollPrefetch } from '@/hooks/useScrollPrefetch';
import {
  RotateCw, X, Sparkles,
  Target, Zap, AlertTriangle, Building2, Send, TrendingUp,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { readLocalStorage, writeLocalStorage } from '@/lib/utils';

const TOUR_KEY = 'NewCareers_dashboard_tour_done';
const FEED_HEIGHT = 660; // 3 card rows
const SALARY_STEP = 5_000;
const SALARY_MAX = 200_000;

export default function PipelineDashboard() {
  const queryClient = useQueryClient();

  // ── Batch 5: infinite + virtualised pipeline feed ────────────────────────
  const {
    data: infiniteData,
    isLoading: loading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteJobsFeed();

  const allJobs: JobCard[] = useMemo(
    () => infiniteData?.pages.flatMap(p => p.items) ?? [],
    [infiniteData],
  );

  const firstPage = infiniteData?.pages[0];
  const dailyCount = firstPage?.dailyCount ?? 0;
  const dailyLimit = firstPage?.dailyLimit ?? 25;

  // D1 – correct ref type
  const feedRef = useRef<VirtualJobFeedHandle>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const { onNearBottom } = useScrollPrefetch({ hasNextPage, isFetchingNextPage, fetchNextPage });

  useEffect(() => () => { fetchAbortRef.current?.abort(); }, []);

  // D3 – stable renderCard so VirtualJobFeed itemData memo holds
  const renderCard = useCallback((job: JobCard) => <JobCardUI job={job} />, []);

  const fetchLive = useFetchLiveJobMutation();
  const [fetchInFlight, setFetchInFlight] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<string | null>(null);
  const { data: analyticsStats, isLoading: statsLoading } = useAnalyticsSummary();
  const { data: profile } = useProfileQuery();
  const minMatch = profile?.minMatchPercent ?? 0;

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [pipelineMinSalary, setPipelineMinSalary] = useState<number | undefined>(undefined);
  const [pipelineMaxSalary, setPipelineMaxSalary] = useState<number | undefined>(undefined);

  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [activeSearchParams, setActiveSearchParams] = useState<SearchParams>({});
  const isSearchMode = searchResult !== null;

  const [plannerJobId, setPlannerJobId] = useState<string | null>(null);
  const [plannerJobTitle, setPlannerJobTitle] = useState<string>('');
  const plannerOpen = plannerJobId !== null;

  const [tourActive, setTourActive] = useState(false);
  useEffect(() => {
    if (!readLocalStorage(TOUR_KEY)) {
      const t = setTimeout(() => setTourActive(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  // Scroll to top on filter change
  useEffect(() => {
    feedRef.current?.scrollToItem(0);
  }, [sourceFilter, minMatch, search, pipelineMinSalary, pipelineMaxSalary]);

  function openPlannerForJob(userJobId: string) {
    const found = allJobs.find(j => j.userJobId === userJobId);
    setPlannerJobTitle(found?.title ?? 'Job');
    setPlannerJobId(userJobId);
  }

  const unwrapCompareData = (value: unknown): CompareData | null =>
    isCompareData(value) ? value : null;
  const unwrapTriageData = (value: unknown): TriageData | null =>
    isTriageData(value) ? value : null;

  const triageSkill = useSkill<TriageData | null>(useCallback(async () => {
    const data = unwrapTriageData((await skillsApi.triage()).data);
    if (!data) throw new Error('Triage skill returned unexpected data.');
    return data;
  }, []));

  async function getMore() {
    const remaining = firstPage?.remaining ?? 0;
    if (remaining <= 0 && allJobs.length > 0) return;
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setFetchInFlight(true);
    setFetchProgress(allJobs.length === 0 ? 'Starting full job search…' : 'Fetching jobs…');
    try {
      const count = allJobs.length === 0 ? 5 : Math.min(5, remaining);
      const result = await fetchJobsOrchestrated(count, status => {
        setFetchProgress(status.message ?? 'Matching jobs to your profile…');
      }, controller.signal);
      await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      if (result.fullSearch) {
        toast.success('Job search complete — your evaluated matches are in the tracker.');
        return;
      }
      const n = result.delivered;
      if (n > 0) {
        toast.success(`Added ${n} new job${n === 1 ? '' : 's'} from all sources.`);
        return;
      }
      toast('No new roles for your profile right now. Try broadening target roles or check back later.');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      toast.error(getUserFacingErrorMessage(e, 'Could not fetch jobs.'));
    } finally {
      setFetchInFlight(false);
      setFetchProgress(null);
    }
  }

  async function handleFetchLiveJobs() {
    if (allJobs.length === 0) {
      await getMore();
      return;
    }
    try {
      const liveJob = await fetchLive.mutateAsync();
      toast.success(`Fetched: ${liveJob.title} at ${liveJob.company}!`);
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e, 'Could not fetch live jobs.'));
    }
  }

  async function handleSearch(params: SearchParams) {
    if (Object.keys(params).length === 0) {
      setSearchResult(null);
      setActiveSearchParams({});
      return;
    }
    setSearching(true);
    try {
      const result = await queryClient.fetchQuery({
        queryKey: queryKeys.discovery.search({ ...params, page: 0 }),
        queryFn: () => discoveryApi.search({ ...params, page: 0 }),
      });
      setSearchResult(result);
      setActiveSearchParams(params);
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e, 'Search failed. Please try again.'));
    } finally {
      setSearching(false);
    }
  }

  async function goToSearchPage(page: number) {
    if (!searchResult || page < 0 || page >= searchResult.totalPages) return;
    if (Object.keys(activeSearchParams).length === 0) return;
    setSearching(true);
    try {
      const result = await queryClient.fetchQuery({
        queryKey: queryKeys.discovery.search({ ...activeSearchParams, page }),
        queryFn: () => discoveryApi.search({ ...activeSearchParams, page }),
      });
      setSearchResult(result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast.error(getUserFacingErrorMessage(e, 'Could not load this page.'));
    } finally {
      setSearching(false);
    }
  }

  function clearPipelineFilters() {
    setSearch('');
    setSourceFilter('All Sources');
    setPipelineMinSalary(undefined);
    setPipelineMaxSalary(undefined);
  }

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

  const topJobs = useMemo(
    () => filteredJobs.filter(
      j => j.kanbanColumn === 'Discovered' || j.kanbanColumn === 'Saved',
    ),
    [filteredJobs],
  );

  const compareJobIds = useMemo(
    () => topJobs.slice(0, 5).map(j => j.userJobId),
    [topJobs],
  );

  const compareSkill = useSkill<CompareData | null>(useCallback(async () => {
    const data = unwrapCompareData((await skillsApi.compare(compareJobIds)).data);
    if (!data) throw new Error('Compare skill returned unexpected data.');
    return data;
  }, [compareJobIds]));

  const missingSkillsMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const j of allJobs) {
      for (const s of j.unmatchedSkills || []) { map[s] = (map[s] || 0) + 1; }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).filter(([, c]) => c >= 2);
  }, [allJobs]);
  const topMissingSkillCount = missingSkillsMap[0]?.[1] ?? 0;

  const activeFilters = search.trim() !== '' || sourceFilter !== 'All Sources'
    || pipelineMinSalary != null || pipelineMaxSalary != null;

  const currentPage  = searchResult?.page ?? 0;
  const totalPages   = searchResult?.totalPages ?? 1;
  const totalResults = searchResult?.total ?? 0;

  return (
    <div className="space-y-8 pb-20">
      <PageMeta title="Job pipeline" />

      {tourActive && (
        <ProductTour
          steps={DASHBOARD_TOUR_STEPS}
          onComplete={() => { writeLocalStorage(TOUR_KEY, '1'); setTourActive(false); }}
          onSkip={() => { writeLocalStorage(TOUR_KEY, '1'); setTourActive(false); }}
        />
      )}

      <FirstApplicationChecklist />

      <section className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">Your Daily Mission</h1>
          <p className="text-slate-400 text-sm mt-1">What should you focus on today?</p>
        </div>
        <div id="dashboard-skill-actions" className="flex flex-wrap items-center gap-2 shrink-0">
          <SkillButton label="Compare" icon={<Target size={15} className="mr-1.5" />}
            state={topJobs.length < 2 ? 'locked' : compareSkill.state} onClick={compareSkill.run}
            className="!rounded-xl !h-9 !text-xs" />
          <SkillButton label="Triage" icon={<Zap size={15} className="mr-1.5" />}
            state={allJobs.length === 0 ? 'locked' : triageSkill.state} onClick={triageSkill.run}
            className="!rounded-xl !h-9 !text-xs" />
          <button onClick={handleFetchLiveJobs} disabled={fetchLive.isPending || fetchInFlight}
            className="flex items-center gap-2 h-9 px-4 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 shadow-sm">
            <Sparkles size={14} className={fetchLive.isPending ? 'animate-spin' : ''} />
            {fetchLive.isPending ? 'Fetching…' : 'Fetch Live Jobs'}
          </button>
          <button onClick={getMore} disabled={fetchInFlight || (allJobs.length > 0 && (firstPage?.remaining ?? 0) <= 0)}
            className="flex items-center gap-2 h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 shadow-sm">
            <RotateCw size={14} className={fetchInFlight ? 'animate-spin' : ''} />
            {fetchInFlight ? (fetchProgress ?? 'Scanning…') : 'Scan For New Jobs'}
          </button>
        </div>
      </section>

      <AnimatePresence>
        {missingSkillsMap.length > 0 && (
          <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-4">
            <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900 mb-2">
                Your CV is missing skills that appear in {topMissingSkillCount}+ of your top matches
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

      <div className="flex flex-col gap-8">
        <section className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">
              {isSearchMode ? `Search Results (${totalResults})` : 'Top Targeted Matches'}
            </h2>
            <div className="flex items-center gap-3">
              {isSearchMode && (
                <button onClick={() => { setSearchResult(null); setActiveSearchParams({}); }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-rose-500 transition-colors">
                  <X size={12} /> Clear search
                </button>
              )}
              {!isSearchMode && dailyCount > 0 && (
                <span className="text-xs text-slate-400">{dailyCount} / {dailyLimit} today</span>
              )}
            </div>
          </div>
          <div className="h-px bg-slate-200 mb-5" />

          <div id="dashboard-search-bar" className="mb-6 flex items-center gap-4">
            <div className="flex-1">
              <JobSearchBar onSearch={handleSearch} loading={searching} />
            </div>
            {!isSearchMode && sourceOptions.length > 2 && (
              <div className="flex items-center gap-2 shrink-0">
                <label htmlFor="source-filter" className="text-xs font-medium text-slate-500 whitespace-nowrap">Source</label>
                <select id="source-filter" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
                  className="h-9 px-3 pr-8 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all cursor-pointer appearance-none">
                  {sourceOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            )}
          </div>

          {!isSearchMode && (
            <div className="mb-5 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <label htmlFor="pipeline-keyword" className="block text-xs font-medium text-slate-500 mb-1">
                  Filter matches
                </label>
                <input
                  id="pipeline-keyword"
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Title or company…"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                />
              </div>
              <div className="w-28">
                <label htmlFor="pipeline-min-salary" className="block text-xs font-medium text-slate-500 mb-1">
                  Min salary (€)
                </label>
                <input
                  id="pipeline-min-salary"
                  type="number"
                  min={0}
                  max={SALARY_MAX}
                  step={SALARY_STEP}
                  value={pipelineMinSalary ?? ''}
                  onChange={e => setPipelineMinSalary(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Any"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                />
              </div>
              <div className="w-28">
                <label htmlFor="pipeline-max-salary" className="block text-xs font-medium text-slate-500 mb-1">
                  Max salary (€)
                </label>
                <input
                  id="pipeline-max-salary"
                  type="number"
                  min={0}
                  max={SALARY_MAX}
                  step={SALARY_STEP}
                  value={pipelineMaxSalary ?? ''}
                  onChange={e => setPipelineMaxSalary(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Any"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                />
              </div>
              {minMatch > 0 && (
                <p className="text-xs text-slate-400 pb-1">
                  Showing {minMatch}%+ match (from profile)
                </p>
              )}
              {activeFilters && (
                <button
                  type="button"
                  onClick={clearPipelineFilters}
                  className="h-9 px-3 text-xs font-semibold text-slate-500 hover:text-rose-500 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {isSearchMode ? (
            searching ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[...Array(3)].map((_, i) => <div key={i} className="h-56 bg-white border border-slate-200 rounded-2xl animate-pulse" />)}
              </div>
            ) : searchResult!.items.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-16 flex flex-col items-center text-center">
                <Building2 size={28} className="text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">No jobs match your search</h3>
                <p className="text-sm text-slate-400 mb-6 max-w-sm">Try different keywords, location, or remove salary filters.</p>
                <button onClick={() => { setSearchResult(null); setActiveSearchParams({}); }}
                  className="px-7 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all">
                  Back to pipeline
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {searchResult!.items.map((j, idx) => (
                  <motion.div key={j.userJobId} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                    <JobCardUI job={j} />
                  </motion.div>
                ))}
              </div>
            )
          ) : (
            loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[...Array(3)].map((_, i) => <div key={i} className="h-56 bg-white border border-slate-200 rounded-2xl animate-pulse" />)}
              </div>
            ) : topJobs.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-16 flex flex-col items-center text-center">
                <Building2 size={28} className="text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-1">
                  {activeFilters ? 'No jobs match your filters' : 'No matches found in database'}
                </h3>
                <p className="text-sm text-slate-400 mb-6 max-w-sm">
                  {activeFilters ? 'Try loosening the filters above.' : "You haven't scanned the market since creating your profile."}
                </p>
                {!activeFilters && (
                  <button onClick={getMore} disabled={fetchInFlight || (allJobs.length > 0 && (firstPage?.remaining ?? 0) <= 0)}
                    className="px-7 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50">
                    {fetchInFlight ? (fetchProgress ?? 'Scanning…') : 'Scan the Market Now'}
                  </button>
                )}
              </div>
            ) : (
              // D2 – JobCard has `id` mapped from userJobId by normalizeJobCard
              <VirtualJobFeed
                ref={feedRef}
                jobs={topJobs}
                height={FEED_HEIGHT}
                onNearBottom={onNearBottom}
                isLoadingMore={isFetchingNextPage}
                renderCard={renderCard}
                aria-label="Your matched job pipeline"
              />
            )
          )}

          {isSearchMode && totalPages > 1 && (
            <div className="flex items-center justify-between mt-8 px-1">
              <button onClick={() => goToSearchPage(currentPage - 1)} disabled={searching || currentPage === 0}
                className="flex items-center gap-1.5 h-9 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-500 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <ChevronLeft size={15} /> Prev
              </button>
              <span className="text-xs text-slate-400 font-medium">
                Page <span className="text-slate-700 font-bold">{currentPage + 1}</span>{' '}of{' '}
                <span className="text-slate-700 font-bold">{totalPages}</span>
                <span className="text-slate-300 mx-1.5">·</span>{totalResults} results
              </span>
              <button onClick={() => goToSearchPage(currentPage + 1)} disabled={searching || currentPage + 1 >= totalPages}
                className="flex items-center gap-1.5 h-9 px-4 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                Next <ChevronRight size={15} />
              </button>
            </div>
          )}

          {!isSearchMode && isFetchingNextPage && (
            <p className="text-center text-xs text-slate-400 mt-4 animate-pulse">Loading more jobs…</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="px-6 py-5 space-y-1">
              {statsLoading ? <div className="h-9 w-20 bg-slate-100 rounded animate-pulse mb-1" />
                : <p className="text-3xl font-black text-slate-900">{analyticsStats?.skillsRunThisWeek ?? 0}</p>}
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Zap size={11} /> Skills Run This Week <ContextualHelpTip tip={HELP_TIPS.skillRun} placement="top" />
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">AI career tools used against jobs in your pipeline.</p>
            </div>
            <div className="px-6 py-5 space-y-1">
              {statsLoading ? <div className="h-9 w-16 bg-slate-100 rounded animate-pulse mb-1" />
                : <p className="text-3xl font-black text-slate-900">{analyticsStats?.applicationsSubmitted ?? 0}</p>}
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Send size={11} /> Applications Submitted
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">Jobs moved to Applied, Interview or Offer stage.</p>
            </div>
            <div className="px-6 py-5 space-y-1">
              {statsLoading ? <div className="h-9 w-20 bg-slate-100 rounded animate-pulse mb-1" />
                : <p className="text-3xl font-black text-emerald-500">{analyticsStats?.avgMatchPercent ?? 0}%</p>}
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Target size={11} /> Avg Match Score <ContextualHelpTip tip={HELP_TIPS.matchScore} placement="top" />
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">Average AI match quality across your full pipeline.</p>
            </div>
          </div>
        </div>
      </section>

      <ComparePanel data={compareSkill.data} open={compareSkill.open} onClose={() => compareSkill.setOpen(false)} jobIds={compareJobIds} />
      <TriagePanel data={triageSkill.data} open={triageSkill.open} onClose={() => triageSkill.setOpen(false)} />

      <AnimatePresence>
        {plannerOpen && (
          <>
            <motion.div key="planner-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40" onClick={() => setPlannerJobId(null)} />
            <motion.div key="planner-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
              <JobPlannerPanel userJobId={plannerJobId!} jobTitle={plannerJobTitle} onClose={() => setPlannerJobId(null)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
