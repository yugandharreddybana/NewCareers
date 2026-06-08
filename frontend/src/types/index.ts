/**
 * types/index.ts — shared domain types
 *
 * D1 fix: User type expanded with avatarUrl, createdAt, planId fields
 *   that BillingPage, Profile, and AccountSettings reference but were
 *   previously missing — causing silent `undefined` accesses with no TS error.
 *
 * D2 fix: JobCard.kanbanColumn typed as KanbanColumn (not plain string)
 *   so TypeScript catches invalid column names at compile time.
 *
 * D3 fix: ApiError type added — pages can now type catch blocks as
 *   ApiError instead of casting `e: any` everywhere.
 */

// ── D3: Shared API error type ─────────────────────────────────────────────────────────
export interface ApiError extends Error {
  /** Normalised error message from the response body or Axios error */
  normalizedMessage: string;
  /** HTTP status code, if available */
  status?: number;
  /** Backend requests CAPTCHA on next login attempt */
  captchaRequired?: boolean;
  /** Seconds until a rate-limited action can be retried */
  retryAfterSeconds?: number;
  response?: {
    data?: { error?: string; message?: string; details?: unknown[]; captchaRequired?: boolean };
    status?: number;
  };
}

/** Type-guard: narrows `unknown` to ApiError */
export function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'normalizedMessage' in e;
}

// ── D1: User — expanded ─────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  onboarded: boolean;
  role?: 'USER' | 'ADMIN';
  // D1 fix: fields used in BillingPage / Profile / AccountSettings
  avatarUrl?: string | null;
  createdAt?: string;
  planId?: string | null;
  planName?: string | null;
  /** False for Google-only accounts without a password hash. */
  passwordLoginEnabled?: boolean;
}

export interface PortfolioItem {
  id: string;
  title: string;
  url?: string;
  description?: string;
  techTags?: string[];
  location?: string;
}

export interface ImportSummary {
  firstName: string;
  lastName: string;
  headline: string;
  location: string;
  positionsImported: number;
  skillsImported: number;
  techStackUpdated: boolean;
  targetRolesUpdated: boolean;
  locationUpdated: boolean;
}

export interface Profile {
  targetRoles?: string[];
  techStack?: string[];
  /** Skills inferred from CV + profile (ATS highlighting). */
  atsKeywords?: string[];
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  availability?: string;
  sectors?: string[];
  freshnessHours?: number;
  minMatchPercent?: number;
  sponsorshipRequired?: boolean;
  onboarded?: boolean;
  activeCvFileName?: string | null;
  activeCvId?: string | null;
  portfolioItems?: PortfolioItem[];
  goalTitle?: string;
  workTypes?: string[];
  goalLocation?: string;
  openToRemote?: boolean;
  experienceLevel?: string;
  workExperience?: Array<{
    jobTitle?: string;
    companyName?: string;
    startDate?: string;
    endDate?: string;
    current?: boolean;
    description?: string;
    location?: string;
  }>;
  education?: Array<{
    schoolName?: string;
    degree?: string;
    degreeLevel?: string;
    degreeTitle?: string;
    fieldOfStudy?: string;
    graduationYear?: string;
    location?: string;
  }>;
  remotePolicy?: string;
  hybridOnsiteDays?: string;
  completenessScore?: number;
  version?: number;
  /** Career domain for Irish permit analytics (TECH, HEALTHCARE, …). */
  jobDomain?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
}

export const KANBAN_COLUMNS = [
  'Discovered', 'Saved', 'Applied', 'Interview', 'Offer', 'Rejected',
] as const;
export type KanbanColumn = typeof KANBAN_COLUMNS[number];

export interface JobCard {
  /** Stable list key — mirrors userJobId for VirtualJobFeed and react-window. */
  id: string;
  userJobId: string;
  jobId: string;
  title: string;
  company: string;
  location: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  sponsorship?: boolean;
  matchPercent?: number;
  preMatchScore?: number;
  verdict?: string;
  humanSummary?: string;
  sourceName?: string;
  sourceUrl?: string;
  postedAt?: string;
  deliveredAt?: string;
  // D2 fix: typed as KanbanColumn (not plain string)
  kanbanColumn: KanbanColumn;
  status: string;
  matchedSkills?: string[];
  unmatchedSkills?: string[];
}

export interface JobDetail extends JobCard {
  description?: string;
  sector?: string;
  aiScore?: number;
  cvImprovementTips?: string[];
  /** Full evaluate-skill JSON from daily job delivery (sections, scores, tips). */
  scoreBreakdown?: Record<string, unknown> | null;
}

export interface JobsListResponse {
  /** All active pipeline jobs, including those below min-match filter. */
  pipelineTotal?: number;
  items: JobCard[];
  dailyCount: number;
  dailyLimit: number;
  remaining: number;
  totalCount?: number;
  page?: number;
  size?: number;
  hasMore?: boolean;
}

export interface FetchSummary {
  delivered: number;
  dailyCount: number;
  dailyLimit: number;
  remaining: number;
  /** True when POST /jobs/fetch started full scrape + AI evaluation (empty pipeline). */
  fullSearchStarted?: boolean;
  message?: string;
}

export interface DailyQuota {
  key: string;
  label: string;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  resetDescription: string;
}

export interface RateLimitHint {
  label: string;
  requestsPerMinute: number;
  windowDescription: string;
}

export interface UsageLimits {
  jobDelivery: DailyQuota;
  aiTokens: DailyQuota;
  skillApi: RateLimitHint;
  generalApi: RateLimitHint;
  timezoneId: string;
}

export interface Stats {
  total: number;
  applied: number;
  interviews: number;
  offers: number;
  avgMatch: number;
}

export type SkillName =
  | 'evaluate' | 'tailor-resume' | 'research' | 'outreach'
  | 'apply' | 'prep-interview' | 'compare' | 'triage' | 'scan' | 'salary-negotiation'
  | 'culture-fit' | 'linkedin-optimize' | 'cover-letter' | 'skills-gap-plan';

export type SkillState = 'idle' | 'loading' | 'done' | 'locked' | 'error';

export interface PlannerTask {
  id: string;
  userJobId: string;
  title: string;
  status: 'PENDING' | 'COMPLETED';
}
