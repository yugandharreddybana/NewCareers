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
  preMatchScore?: number;       // fast keyword pre-score (0-100)
  verdict?: string;
  humanSummary?: string;        // 1-line Gemini plain-English summary
  sourceName?: string;          // e.g. "LinkedIn (Twin AI)", "IrishJobs", "Reed"
  sourceUrl?: string;           // direct link to the original job posting
  postedAt?: string;
  deliveredAt?: string;
  kanbanColumn: string;
  status: string;
  // Included in list response so Dashboard can render CV Skills Gap banner
  matchedSkills?: string[];
  unmatchedSkills?: string[];
}

export interface JobDetail extends JobCard {
  description?: string;
  sector?: string;
  aiScore?: number;
  cvImprovementTips?: string[];
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
