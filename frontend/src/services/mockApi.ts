/**
 * mockApi.ts — mock data for VITE_USE_MOCKS=true development mode.
 *
 * G14/G15 fix (Batch 7d): added MOCK_* data for the 9 API modules
 * that previously lived only in src/api/ and had no mock branches.
 * With these exports, any future refactor that adds USE_MOCKS guards
 * to those modules has ready-made data to return.
 *
 * Modules now covered:
 *   agentMemoryApi, autoApplyApi, networkingApi, outreachApi,
 *   plannerApi, progressApi, resumeVersionApi, watchlistApi, workspaceApi
 */
import { User, JobCard, JobDetail, FetchSummary, Stats } from '@/types';

// ────────────────────────────────────────────────────────────────────────────────
// Core mocks (unchanged)
// ────────────────────────────────────────────────────────────────────────────────
export const MOCK_USER: User = {
  id: 'dev-user-123',
  name: 'Dev Tester',
  username: 'devtester',
  email: 'dev@careerops.ie',
  onboarded: true,
  role: 'ADMIN',
};

export const MOCK_JOBS: JobCard[] = [
  {
    userJobId: 'uj-1',
    jobId: 'j-1',
    title: 'Senior Frontend Engineer (React)',
    company: 'TechWave Ireland',
    location: 'Dublin (Hybrid)',
    salaryMin: 75000,
    salaryMax: 95000,
    currency: 'EUR',
    sponsorship: true,
    matchPercent: 92,
    preMatchScore: 88,
    verdict: 'Strong Match',
    humanSummary: 'A senior role at a growing Dublin fintech using React and TypeScript.',
    sourceName: 'LinkedIn',
    sourceUrl: 'https://linkedin.com/jobs/1',
    postedAt: new Date().toISOString(),
    deliveredAt: new Date().toISOString(),
    kanbanColumn: 'Discovered',
    status: 'new',
    matchedSkills: ['React', 'TypeScript', 'Tailwind CSS', 'Redux'],
    unmatchedSkills: ['GraphQL'],
  },
  {
    userJobId: 'uj-2',
    jobId: 'j-2',
    title: 'Lead Full Stack Developer',
    company: 'EcoGrowth',
    location: 'Cork (Remote)',
    salaryMin: 80000,
    salaryMax: 110000,
    currency: 'EUR',
    sponsorship: false,
    matchPercent: 85,
    preMatchScore: 82,
    verdict: 'Good Fit',
    humanSummary: 'Leading a green-tech team building sustainability dashboards.',
    sourceName: 'IrishJobs',
    sourceUrl: 'https://irishjobs.ie/jobs/2',
    postedAt: new Date(Date.now() - 86400000).toISOString(),
    deliveredAt: new Date().toISOString(),
    kanbanColumn: 'Saved',
    status: 'interested',
    matchedSkills: ['Node.js', 'React', 'PostgreSQL'],
    unmatchedSkills: ['AWS Lambda', 'Terraform'],
  },
  {
    userJobId: 'uj-3',
    jobId: 'j-3',
    title: 'Product Designer',
    company: 'DesignScale',
    location: 'Dublin',
    salaryMin: 60000,
    salaryMax: 80000,
    currency: 'EUR',
    sponsorship: false,
    matchPercent: 45,
    preMatchScore: 40,
    verdict: 'Low Match',
    humanSummary: 'UI/UX focus, might be too design-heavy for your current profile.',
    sourceName: 'Indeed',
    sourceUrl: 'https://indeed.com/jobs/3',
    postedAt: new Date(Date.now() - 172800000).toISOString(),
    deliveredAt: new Date().toISOString(),
    kanbanColumn: 'Rejected',
    status: 'rejected',
    matchedSkills: ['Figma'],
    unmatchedSkills: ['CSS', 'Animation', 'User Research'],
  }
];

export const MOCK_JOB_DETAIL: JobDetail = {
  ...MOCK_JOBS[0]!,
  description: `
    ## About the Role
    TechWave is looking for a Senior Frontend Engineer to lead our customer portal redesign. 
    You will work closely with our design team to implement a premium, high-performance dashboard.

    ## Requirements
    - 5+ years experience with React.
    - Strong TypeScript skills.
    - Experience with Tailwind CSS and Framer Motion.
    - Knowledge of accessibility best practices.

    ## Benefits
    - Competitive salary and equity.
    - Full health insurance.
    - Flexible hybrid working model.
  `,
  sector: 'Fintech',
  aiScore: 94,
  cvImprovementTips: [
    'Highlight your experience with high-traffic React applications.',
    'Mention your contribution to design systems.',
  ],
};

export const MOCK_STATS: Stats = {
  total: 42,
  applied: 12,
  interviews: 4,
  offers: 1,
  avgMatch: 78,
};

export const MOCK_FETCH_SUMMARY: FetchSummary = {
  delivered: 5,
  dailyCount: 8,
  dailyLimit: 15,
  remaining: 7,
};

export const MOCK_SKILL_RESULTS: Record<string, unknown> = {
  'evaluate': {
    match: 92,
    pros: ['Perfect tech stack alignment', 'Strong domain experience', 'Hybrid location fits preference'],
    cons: ['Slightly above the listed salary range', 'Requires travel once a month'],
    verdict: 'High priority. The tech stack is a 100% match for your background.'
  },
  'research': {
    companySize: '250-500 employees',
    culture: 'Fast-paced, engineering-led, remote-friendly but values hybrid connection.',
    funding: 'Series C ($45M raised in 2023)',
    recentNews: 'Recently expanded into the German market. Hired a new CTO from Stripe.',
    interviewProcess: '1. Recruiter Screen, 2. Technical Panel, 3. Design/Product Sync, 4. Final Leadership Chat.'
  },
  'tailor-resume': {
    text: 'Your resume has been tailored for TechWave. Key changes: Emphasized fintech experience and React leadership roles.',
    matchingScore: 95
  },
  'outreach': {
    linkedin: "Hi [Name], I noticed TechWave is hiring for a Senior Frontend Engineer. Given my background in React and Fintech at [Previous Company], I'm very interested in the role. Would you be open to a brief chat?",
    email: "Subject: Senior Frontend Engineer Application - [Your Name]\n\nDear [Name],\n\nI am writing to express my interest in the Senior Frontend Engineer position..."
  }
};

// ────────────────────────────────────────────────────────────────────────────────
// G14/G15 fix: mock data for the 9 formerly-orphaned api/ modules
// ────────────────────────────────────────────────────────────────────────────────

// agentMemoryApi
export const MOCK_AGENT_MEMORIES = {
  memories: [
    { id: 'mem-1', category: 'career', key: 'target_role', value: 'Senior Full Stack Developer', source: 'onboarding', whySuggested: null, confidence: 0.95, memoryEnabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'mem-2', category: 'preferences', key: 'remote_preference', value: 'hybrid', source: 'profile', whySuggested: null, confidence: 0.88, memoryEnabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  total: 2,
};

// autoApplyApi
export const MOCK_AUTO_APPLY_ANSWERS = [
  { id: 'ans-1', questionText: 'Do you have the right to work in Ireland?', answerText: 'Yes', questionType: 'boolean', confidence: 1.0, source: 'profile', lastUsed: new Date().toISOString(), useCount: 5 },
  { id: 'ans-2', questionText: 'Years of experience with React?', answerText: '4', questionType: 'number', confidence: 0.9, source: 'cv', lastUsed: new Date().toISOString(), useCount: 12 },
];
export const MOCK_AUTO_APPLY_SESSIONS = {
  sessions: [
    { id: 'sess-1', status: 'completed', jobTitle: 'Senior Frontend Engineer', company: 'TechWave', appliedAt: new Date().toISOString(), outcome: 'submitted' },
  ],
  total: 1,
};

// networkingApi
export const MOCK_NETWORK_CONTACTS = {
  contacts: [
    { id: 'cnt-1', name: 'Jane Recruiter', email: 'jane@techwave.ie', linkedinUrl: null, company: 'TechWave Ireland', roleTitle: 'Talent Acquisition', contactType: 'recruiter', relationshipTemperature: 'warm', pipelineStage: 'outreached', notes: 'Met at Web Summit', linkedUserJobId: 'uj-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastInteraction: null },
  ],
  total: 1,
};

// outreachApi
export const MOCK_OUTREACH_CAMPAIGNS = {
  campaigns: [
    { id: 'camp-1', name: 'Q2 Dublin Fintech Push', campaignType: 'linkedin', status: 'active', targetCount: 20, sentCount: 8, repliedCount: 3, positiveCount: 2, replyRate: 0.375, createdAt: new Date().toISOString(), sequences: [], messages: [] },
  ],
  total: 1,
};

// plannerApi
export const MOCK_PLANNER_UPCOMING = {
  tasks: [
    { id: 'task-1', title: 'Prepare for TechWave interview', dueDate: new Date(Date.now() + 86400000 * 2).toISOString(), completed: false, userJobId: 'uj-1' },
  ],
  deadlines: [
    { id: 'dl-1', title: 'Submit assessment', eventDate: new Date(Date.now() + 86400000 * 3).toISOString(), eventType: 'assessment', userJobId: 'uj-1' },
  ],
};

// progressApi
export const MOCK_WEEKLY_SUMMARY = {
  id: 'ws-1',
  weekStart: new Date(Date.now() - 86400000 * 6).toISOString(),
  weekEnd: new Date().toISOString(),
  jobsReviewed: 12,
  applicationsSubmitted: 3,
  interviewsScheduled: 1,
  responsesReceived: 2,
  offersReceived: 0,
  dailyUseStreak: 5,
  winsSummary: 'Landed an interview at TechWave.',
  bottlenecksSummary: null,
  recommendations: 'Keep applying — response rate is above average.',
  bestPerformingCategory: 'React roles',
  responseRate: 0.25,
  interviewRate: 0.083,
  createdAt: new Date().toISOString(),
};
export const MOCK_STREAKS = {
  currentDailyStreak: 5,
  longestDailyStreak: 12,
  lastActiveDate: new Date().toISOString(),
  totalJobsReviewed: 42,
  totalAppsSubmitted: 12,
  badges: [
    { key: 'first_app', label: 'First Application', icon: '🎉', earned: true },
    { key: 'week_streak', label: '7-Day Streak', icon: '🔥', earned: false },
  ],
};

// resumeVersionApi
export const MOCK_RESUME_VERSIONS = {
  versions: [
    { id: 'rv-1', name: 'Senior FE — Fintech Focus', versionNumber: 1, source: 'upload', roleTags: ['frontend', 'fintech'], isActive: true, isFavorite: true, outcomeAssociation: null, interviewCount: 2, applicationCount: 5, offerCount: 0, bestForRoleType: 'Senior Frontend Engineer', notes: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  total: 1,
};

// watchlistApi
export const MOCK_WATCHLISTS = {
  watchlists: [
    { id: 'wl-1', name: 'Dublin Senior React Roles', queryKeywords: 'React TypeScript', location: 'Dublin', minSalary: 70000, maxSalary: null, remoteOnly: false, sponsorshipRequired: false, minMatchScore: 70, alertEmail: true, alertInApp: true, status: 'active', lastRunAt: new Date().toISOString(), matchedTotal: 8, clickedTotal: 3, appliedTotal: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  total: 1,
};

// workspaceApi
export const MOCK_WORKSPACES = [
  { id: 'ws-1', ownerId: 'dev-user-123', name: 'My Career Workspace', description: 'Personal review workspace', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), members: [] },
];
