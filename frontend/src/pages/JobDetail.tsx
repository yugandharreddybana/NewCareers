import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PageMeta } from '@/components/PageMeta';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { DashboardTopNav } from '@/components/dashboard/DashboardTopNav';
import { kanbanApi } from '@/services/api';
import { useJobDetail } from '@/hooks/queries';
import { queryKeys } from '@/lib/queryKeys';
import type { JobDetail } from '@/types';
type JobDetailTab = 'overview' | 'skills';
import { JobDetailSkillsTab } from '@/components/job-detail/JobDetailSkillsTab';
import { SKILL_COUNT } from '@/lib/skillCatalog';
import {
  hasActionableCvTips,
  isHeuristicPlaceholderEvaluation,
} from '@/lib/jobEvaluation';
import '@/styles/job-detail.css';

function formatSalary(min?: number, max?: number, currency?: string): string {
  if (!min && !max) return 'Competitive';
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  const fmt = (n: number) => `${symbol}${Math.round(n / 1000)}k`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `Up to ${fmt(max!)}`;
}

function matchRingOffset(percent: number): number {
  const circumference = 2 * Math.PI * 58;
  return circumference * (1 - percent / 100);
}

const JobDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: jobData, isLoading: loading, refetch } = useJobDetail(id);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<JobDetailTab>('overview');
  const [openEvaluationSignal, setOpenEvaluationSignal] = useState(0);
  const [savedColumn, setSavedColumn] = useState<JobDetail['kanbanColumn'] | null>(null);

  const displayJob = jobData && savedColumn
    ? { ...jobData, kanbanColumn: savedColumn }
    : jobData;

  useEffect(() => {
    if (searchParams.get('tab') === 'skills') {
      setActiveTab('skills');
    }
  }, [searchParams]);

  useEffect(() => {
    setSavedColumn(null);
  }, [id]);

  useEffect(() => {
    if (!id || loading || !jobData || jobData.description?.trim()) return;
    const timer = window.setTimeout(() => {
      void refetch();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [id, loading, jobData, refetch]);

  const refreshJob = useCallback(async () => {
    if (!id) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(id) });
  }, [id, queryClient]);

  const openJobEvaluation = useCallback(() => {
    setActiveTab('skills');
    setOpenEvaluationSignal(n => n + 1);
  }, []);

  const handleApply = () => {
    if (!displayJob) return;
    if (displayJob.sourceUrl) {
      window.open(displayJob.sourceUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    toast('Apply via the original job posting.');
  };

  const handleSave = async () => {
    if (!displayJob) return;
    setSaving(true);
    try {
      await kanbanApi.patch(displayJob.userJobId, { kanbanColumn: 'Saved' });
      setSavedColumn('Saved');
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      toast.success('Saved for later.');
    } catch {
      toast.error('Could not save this job.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="job-detail-page min-h-screen bg-surface-container-low flex flex-col">
        <DashboardTopNav />
        <div className="flex flex-1 items-center justify-center py-24">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (!displayJob && !loading) {
    return (
      <div className="job-detail-page min-h-screen bg-surface-container-low flex flex-col">
        <DashboardTopNav />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl">search_off</span>
          <p className="text-sm">Job not found.</p>
          <Link to="/jobs" className="text-primary text-sm font-label-md hover:underline">
            Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  if (!displayJob) return null;

  const job = displayJob;
  const matchPercent = job.matchPercent ?? 0;
  const heuristicEval = isHeuristicPlaceholderEvaluation(job);
  const showCvTips = hasActionableCvTips(job);
  const sectorLabel = job.sector ?? '';
  const postedLabel = job.postedAt
    ? `${Math.max(0, Math.floor((Date.now() - new Date(job.postedAt).getTime()) / 86_400_000))} days ago`
    : 'Recently';

  function companyInitials(company: string): string {
    return company
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  return (
    <div className="job-detail-page min-h-screen bg-surface-container-low flex flex-col">
      <PageMeta title={`${job.title} at ${job.company} | NewCareers`} />
      <DashboardTopNav />

      <main className="max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop py-base flex-grow">
        <nav className="flex flex-wrap items-center gap-2 py-6" aria-label="Breadcrumb">
          <Link
            to="/jobs"
            className="flex items-center text-primary font-label-md text-label-md hover:underline"
          >
            <span className="material-symbols-outlined mr-1 text-[20px]">arrow_back</span>
            Back to Jobs
          </Link>
          {sectorLabel && (
            <>
              <span className="text-outline text-label-md">/</span>
              <span className="text-secondary text-label-md">{sectorLabel}</span>
            </>
          )}
          <span className="text-outline text-label-md">/</span>
          <span className="text-secondary text-label-md">{job.title}</span>
        </nav>

        <div className="grid grid-cols-12 gap-gutter items-start pb-12">
          <section className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            <div className="bg-surface-container-lowest p-margin-mobile md:p-margin-desktop rounded-xl border border-outline-variant shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-secondary-container flex items-center justify-center overflow-hidden shrink-0">
                    <span className="font-headline-sm text-headline-sm text-on-secondary-container">
                      {companyInitials(job.company)}
                    </span>
                  </div>
                  <div>
                    <h1 className="font-headline-lg text-headline-lg text-on-surface">{job.title}</h1>
                    <p className="font-body-lg text-body-lg text-secondary">
                      {job.company} • {job.location}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {job.sourceName && (
                    <span className="px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full font-label-sm text-label-sm">
                      {job.sourceName}
                    </span>
                  )}
                  {job.sponsorship ? (
                    <span className="px-3 py-1 bg-tertiary-container text-on-tertiary-container rounded-full font-label-sm text-label-sm">
                      Sponsorship
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div
              className="flex gap-1 p-1 bg-surface-container-low rounded-xl border border-outline-variant"
              role="tablist"
              aria-label="Job detail sections"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'overview'}
                onClick={() => setActiveTab('overview')}
                className={[
                  'flex-1 py-3 px-4 rounded-lg font-label-md text-label-md transition-all',
                  activeTab === 'overview'
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm border border-outline-variant'
                    : 'text-secondary hover:text-on-surface',
                ].join(' ')}
              >
                Overview
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'skills'}
                onClick={() => setActiveTab('skills')}
                className={[
                  'flex-1 py-3 px-4 rounded-lg font-label-md text-label-md transition-all flex items-center justify-center gap-2',
                  activeTab === 'skills'
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm border border-outline-variant'
                    : 'text-secondary hover:text-on-surface',
                ].join(' ')}
              >
                <span
                  className="material-symbols-outlined text-[18px] text-primary"
                  style={activeTab === 'skills' ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  auto_awesome
                </span>
                AI Skills
                <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold">
                  {SKILL_COUNT}
                </span>
              </button>
            </div>

            <div className={activeTab === 'skills' ? '' : 'hidden'} aria-hidden={activeTab !== 'skills'}>
              <JobDetailSkillsTab
                job={job}
                openEvaluationSignal={openEvaluationSignal}
                onJobRefresh={refreshJob}
              />
            </div>
            {activeTab !== 'skills' ? (
              <>
            <div className="bg-surface-container-lowest p-margin-mobile md:p-margin-desktop rounded-xl border border-outline-variant shadow-sm">
                <h2 className="font-headline-sm text-headline-sm mb-4 text-on-surface">Job Description</h2>
                {job.description ? (
                  <p className="font-body-md text-body-md text-on-surface-variant mb-6 leading-relaxed whitespace-pre-wrap">
                    {job.description}
                  </p>
                ) : (
                  <div className="space-y-4 mb-6">
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      We could not load the full posting text yet. Try refreshing this page in a moment, or open
                      the original listing if it still does not appear.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void refetch()}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-outline-variant text-primary font-label-md hover:bg-surface-container-high transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">refresh</span>
                        Retry loading description
                      </button>
                      {job.sourceUrl && (
                        <a
                          href={job.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface font-label-md hover:bg-surface-container-high transition-colors"
                        >
                          <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                          Open on {job.sourceName ?? 'source site'}
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {job.sector && (
                  <div className="flex items-center gap-2 text-secondary">
                    <span className="material-symbols-outlined text-[18px]">category</span>
                    <span className="font-label-sm text-label-sm">{job.sector}</span>
                  </div>
                )}
            </div>

            {(job.humanSummary || heuristicEval) && (
              <div className="bg-surface-container-lowest p-margin-mobile md:p-margin-desktop rounded-xl border border-primary/20 shadow-sm">
                <h2 className="font-headline-sm text-headline-sm mb-3 text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">insights</span>
                  AI match summary
                </h2>
                {job.humanSummary && (
                  <p className="font-body-md text-body-md text-on-surface-variant mb-4">{job.humanSummary}</p>
                )}
                {heuristicEval && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-outline-variant">
                    <p className="font-body-sm text-body-sm text-on-surface-variant flex-1">
                      Run a full Job Evaluation for CV tips, skill gaps, and a detailed score breakdown.
                    </p>
                    <button
                      type="button"
                      onClick={openJobEvaluation}
                      className="shrink-0 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors"
                    >
                      Run full evaluation
                    </button>
                  </div>
                )}
                {!heuristicEval && job.matchedSkills && job.matchedSkills.length > 0 && (
                  <div className="mt-4">
                    <p className="font-label-sm text-label-sm text-secondary uppercase mb-2">Matched skills</p>
                    <div className="flex flex-wrap gap-2">
                      {job.matchedSkills.map(skill => (
                        <span
                          key={skill}
                          className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {showCvTips && (
              <div className="bg-surface-container-lowest p-margin-mobile md:p-margin-desktop rounded-xl border border-outline-variant shadow-sm">
                <h2 className="font-headline-sm text-headline-sm mb-4 text-on-surface">CV Improvement Tips</h2>
                <ul className="list-disc list-outside ml-5 space-y-2 text-on-surface-variant font-body-md text-body-md">
                  {job.cvImprovementTips!.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-surface-container-lowest p-margin-mobile md:p-margin-desktop rounded-xl border border-outline-variant shadow-sm">
              <h2 className="font-headline-sm text-headline-sm mb-4 text-on-surface">Source</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                This job was sourced from{' '}
                <strong className="text-on-surface">{job.sourceName || 'a job board'}</strong>.
                {job.sourceUrl && (
                  <>
                    {' '}
                    <a
                      href={job.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View original posting
                      <span className="material-symbols-outlined text-sm ml-1 align-middle">open_in_new</span>
                    </a>
                  </>
                )}
              </p>
            </div>
              </>
            ) : null}
          </section>

          <aside className="col-span-12 lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-24">
            <div className="bg-surface-container-lowest p-margin-mobile md:p-margin-desktop rounded-xl border border-outline-variant shadow-md">
              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-2 gap-4">
                  <span className="font-label-sm text-label-sm text-secondary uppercase">Salary Range</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface text-right">
                    {formatSalary(job.salaryMin, job.salaryMax, job.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline gap-4">
                  <span className="font-label-sm text-label-sm text-secondary uppercase">Location</span>
                  <span className="font-body-md text-body-md text-on-surface text-right">{job.location}</span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleApply}
                  className="w-full bg-primary hover:bg-primary-container text-on-primary py-4 rounded-lg font-label-md text-label-md font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                  Apply Now
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-surface-container-lowest border border-outline text-on-surface py-4 rounded-lg font-label-md text-label-md font-medium hover:bg-surface-container transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-xl">bookmark</span>
                  Save for Later
                </button>
              </div>
              <div className="mt-6 pt-6 border-t border-outline-variant flex items-center gap-3 text-secondary">
                <span className="material-symbols-outlined">schedule</span>
                <span className="font-body-sm text-body-sm">
                  {postedLabel}
                </span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-margin-mobile md:p-margin-desktop rounded-xl border border-primary/30 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2">
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                  AI Insights
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm mb-6 flex items-center gap-2 text-on-surface">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  auto_awesome
                </span>
                AI Match Analysis
              </h3>

              <div className="flex flex-col items-center mb-8">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128" aria-hidden>
                    <circle
                      className="text-surface-container-high"
                      cx="64"
                      cy="64"
                      fill="transparent"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                    />
                    <circle
                      className="text-primary transition-all duration-1000 ease-out"
                      cx="64"
                      cy="64"
                      fill="transparent"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray={364.4}
                      strokeDashoffset={matchRingOffset(matchPercent)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-bold text-on-surface">{matchPercent}%</span>
                    <span className="text-[10px] text-secondary uppercase font-bold tracking-tighter">
                      Match Score
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {job.matchedSkills && job.matchedSkills.length > 0 && (
                  <div>
                    <p className="font-label-sm text-label-sm text-secondary uppercase mb-3">Key Skills Found</p>
                    <div className="flex flex-wrap gap-2">
                      {job.matchedSkills.map(skill => (
                        <span
                          key={skill}
                          className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {job.unmatchedSkills && job.unmatchedSkills.length > 0 && (
                  <div>
                    <p className="font-label-sm text-label-sm text-secondary uppercase mb-3">
                      Missing Skills / Gaps
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {job.unmatchedSkills.map((skill, i) => (
                        <span
                          key={skill}
                          className={
                            i === 0
                              ? 'px-2 py-1 bg-error-container text-on-error-container border border-error/20 rounded text-xs font-medium'
                              : 'px-2 py-1 bg-surface-container-high text-on-surface-variant border border-outline-variant rounded text-xs font-medium'
                          }
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {job.humanSummary && (
                  <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                    <p className="font-body-sm text-body-sm text-on-surface-variant italic">
                      &ldquo;{job.humanSummary}&rdquo;
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={openJobEvaluation}
                  className="mt-4 w-full py-3 rounded-lg border border-primary/30 bg-primary/5 text-primary font-label-md text-label-md hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">analytics</span>
                  View job evaluation
                </button>
              </div>
            </div>

            {job.verdict && (
              <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm">
                <p className="font-label-sm text-label-sm text-secondary uppercase mb-1">Verdict</p>
                <p className="font-headline-sm text-headline-sm text-on-surface">{job.verdict}</p>
              </div>
            )}
          </aside>
        </div>
      </main>

      <footer className="mt-auto bg-surface-container-low border-t border-outline-variant py-12">
        <div className="w-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-center gap-base">
          <div className="flex flex-col items-center md:items-start gap-2">
            <span className="font-headline-sm text-headline-sm font-bold text-on-surface">NewCareers AI</span>
            <p className="font-body-sm text-body-sm text-secondary">© 2024 NewCareers AI. Empowering momentum.</p>
          </div>
          <div className="flex flex-wrap gap-6 justify-center">
            <Link className="font-body-sm text-body-sm text-secondary hover:text-primary underline transition-all" to="/privacy">
              Privacy Policy
            </Link>
            <Link className="font-body-sm text-body-sm text-secondary hover:text-primary underline transition-all" to="/terms">
              Terms of Service
            </Link>
            <a className="font-body-sm text-body-sm text-secondary hover:text-primary underline transition-all" href="#">
              Contact Support
            </a>
            <a className="font-body-sm text-body-sm text-secondary hover:text-primary underline transition-all" href="#">
              Career Advice
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default JobDetail;
