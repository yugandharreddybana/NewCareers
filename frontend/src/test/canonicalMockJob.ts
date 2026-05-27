/**
 * Canonical mock job — single source for Vitest/MSW fixtures.
 * Keep in sync with shared/canonical-mock-job.json and backend h2-dev-seed.sql.
 */
import canonical from '../../../shared/canonical-mock-job.json';
import type { RecommendedJob } from '@/services/discoveryApi';
import type { FetchSummary, JobCard, JobDetail, Stats } from '@/types';

export const CANONICAL_MOCK_JOB_IDS = canonical.ids;

export const MOCK_JOB: JobCard = canonical.card as JobCard;

export const MOCK_JOBS: JobCard[] = [MOCK_JOB];

export const MOCK_JOB_DETAIL: JobDetail = {
  ...MOCK_JOB,
  ...(canonical.detail as Omit<JobDetail, keyof JobCard>),
  scoreBreakdown: canonical.userJob.scoreBreakdown as Record<string, unknown>,
};

export const MOCK_FETCH_SUMMARY: FetchSummary = canonical.fetchSummary;

export const MOCK_STATS: Stats = canonical.stats;

export const MOCK_SKILL_RESULTS: Record<string, unknown> = canonical.skillResults;

export const MOCK_LIST_META = canonical.listMeta;

export const MOCK_RECOMMENDED_JOBS: RecommendedJob[] = [
  {
    userJobId: MOCK_JOB.userJobId,
    title: MOCK_JOB.title,
    company: MOCK_JOB.company,
    location: MOCK_JOB.location,
    matchPercent: MOCK_JOB.matchPercent ?? (canonical.card.matchPercent as number),
    ...(MOCK_JOB.salaryMin != null ? { salaryMin: MOCK_JOB.salaryMin } : {}),
    ...(MOCK_JOB.salaryMax != null ? { salaryMax: MOCK_JOB.salaryMax } : {}),
    ...(MOCK_JOB.currency != null ? { currency: MOCK_JOB.currency } : {}),
    ...(MOCK_JOB.sourceUrl != null ? { sourceUrl: MOCK_JOB.sourceUrl } : {}),
    ...(MOCK_JOB.sourceName != null ? { sourceName: MOCK_JOB.sourceName } : {}),
    ...(MOCK_JOB.postedAt != null ? { postedAt: MOCK_JOB.postedAt } : {}),
    whyRecommended: canonical.recommended.whyRecommended,
  },
];
