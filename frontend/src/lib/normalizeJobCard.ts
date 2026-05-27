import type { JobCard, JobDetail, KanbanColumn } from '@/types';

type RawJob = Partial<JobCard> & {
  user_job_id?: string;
  job_id?: string;
  kanban_column?: string;
  match_percent?: number;
  salary_min?: number;
  salary_max?: number;
  source_name?: string;
  source_url?: string;
  human_summary?: string;
  delivered_at?: string;
  posted_at?: string;
  matched_skills?: string[];
  unmatched_skills?: string[];
};

function readId(raw: RawJob, camel: 'userJobId' | 'jobId'): string {
  const snake = camel === 'userJobId' ? raw.user_job_id : raw.job_id;
  const value = raw[camel] ?? snake;
  return value != null ? String(value) : '';
}

/** Maps Java JobCardResponse JSON (UUID fields) into frontend JobCard. */
export function normalizeJobCard(raw: Partial<JobCard>): JobCard {
  const r = raw as RawJob;
  const col = r.kanbanColumn ?? r.kanban_column;
  const kanbanColumn: KanbanColumn =
    col === 'Saved' ||
    col === 'Applied' ||
    col === 'Interview' ||
    col === 'Offer' ||
    col === 'Rejected'
      ? col
      : 'Discovered';

  const userJobId = readId(r, 'userJobId');
  const jobId = readId(r, 'jobId') || userJobId;

  const card: JobCard = {
    userJobId,
    jobId,
    title: String(raw.title ?? 'Role'),
    company: String(raw.company ?? ''),
    location: String(raw.location ?? ''),
    kanbanColumn,
    status: String(raw.status ?? 'new'),
  };

  const matchPercent = r.matchPercent ?? r.match_percent;
  if (matchPercent != null) card.matchPercent = Number(matchPercent);
  const salaryMin = r.salaryMin ?? r.salary_min;
  if (salaryMin != null) card.salaryMin = Number(salaryMin);
  const salaryMax = r.salaryMax ?? r.salary_max;
  if (salaryMax != null) card.salaryMax = Number(salaryMax);
  if (r.currency) card.currency = String(r.currency);
  const sourceName = r.sourceName ?? r.source_name;
  if (sourceName) card.sourceName = String(sourceName);
  const sourceUrl = r.sourceUrl ?? r.source_url;
  if (sourceUrl) card.sourceUrl = String(sourceUrl);
  const humanSummary = r.humanSummary ?? r.human_summary;
  if (humanSummary) card.humanSummary = String(humanSummary);
  if (r.verdict) card.verdict = String(r.verdict);
  const deliveredAt = r.deliveredAt ?? r.delivered_at;
  if (deliveredAt) card.deliveredAt = String(deliveredAt);
  const postedAt = r.postedAt ?? r.posted_at;
  if (postedAt) card.postedAt = String(postedAt);
  if (r.matchedSkills) card.matchedSkills = r.matchedSkills;
  if (r.unmatchedSkills) card.unmatchedSkills = r.unmatchedSkills;

  return card;
}

/** Normalizes GET /jobs/:userJobId detail payloads. */
export function normalizeJobDetail(raw: Partial<JobDetail>): JobDetail {
  const r = raw as RawJob & Partial<JobDetail> & {
    ai_score?: number;
    cv_improvement_tips?: string[];
    score_breakdown?: Record<string, unknown> | null;
  };
  const card = normalizeJobCard(r);
  const detail: JobDetail = { ...card };
  if (r.description) detail.description = String(r.description);
  if (r.sector) detail.sector = String(r.sector);
  const aiScore = r.aiScore ?? r.ai_score;
  if (aiScore != null) detail.aiScore = Number(aiScore);
  const tips = r.cvImprovementTips ?? r.cv_improvement_tips;
  if (tips) detail.cvImprovementTips = tips;
  const breakdown = r.scoreBreakdown ?? r.score_breakdown;
  if (breakdown) detail.scoreBreakdown = breakdown;
  return detail;
}

/** Route param for job detail — always the user_jobs row id. */
export function jobDetailPath(userJobId: string): string {
  return `/jobs/${userJobId}`;
}
