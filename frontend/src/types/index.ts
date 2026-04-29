export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  onboarded: boolean;
}

export interface Profile {
  targetRoles?: string[];
  techStack?: string[];
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  sectors?: string[];
  freshnessHours?: number;
  minMatchPercent?: number;
  sponsorshipRequired?: boolean;
  onboarded?: boolean;
  activeCvFileName?: string | null;
}

export interface JobCard {
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
  verdict?: string;
  postedAt?: string;
  deliveredAt?: string;
  kanbanColumn: string;
  status: string;
  sourceUrl?: string;
}

export interface JobDetail extends JobCard {
  description?: string;
  sourceName?: string;
  sector?: string;
  aiScore?: number;
  matchedSkills?: string[];
  unmatchedSkills?: string[];
  cvImprovementTips?: string[];
  humanSummary?: string;
}

export interface JobsListResponse {
  items: JobCard[];
  dailyCount: number;
  dailyLimit: number;
  remaining: number;
}

export interface FetchSummary {
  delivered: number;
  dailyCount: number;
  dailyLimit: number;
  remaining: number;
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
  | 'apply'    | 'prep-interview' | 'compare' | 'triage';

export type SkillState = 'idle' | 'loading' | 'done' | 'locked' | 'error';

export const KANBAN_COLUMNS = ['Discovered','Saved','Applied','Interview','Offer','Rejected'] as const;
export type KanbanColumn = typeof KANBAN_COLUMNS[number];
