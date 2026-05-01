export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  onboarded: boolean;
}

// Section 10 — portfolio item
export interface PortfolioItem {
  id: string;
  title: string;
  url?: string;
  description?: string;
  techTags?: string[];
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
  // Section 10 additions
  portfolioItems?: PortfolioItem[];
  goalTitle?: string;
  goalSalaryMin?: number;
  goalSalaryMax?: number;
  goalLocation?: string;
  openToRemote?: boolean;
}

// Section 10 — LinkedIn import summary
export interface ImportSummary {
  firstName: string;
  lastName: string;
  headline: string;
  summary: string;
  positionsImported: number;
  skillsImported: number;
  locationUpdated: boolean;
  message: string;
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
  preMatchScore?: number;
  verdict?: string;
  humanSummary?: string;
  sourceName?: string;
  sourceUrl?: string;
  postedAt?: string;
  deliveredAt?: string;
  kanbanColumn: string;
  status: string;
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
