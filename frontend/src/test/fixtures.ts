/**
 * test/fixtures.ts — MSW handler fixtures for unit/integration tests only.
 * Not used by the production application.
 *
 * Job data: shared/canonical-mock-job.json (also seeded in backend h2-dev-seed.sql).
 */
import type { User } from '@/types';
import {
  CANONICAL_MOCK_JOB_IDS,
  MOCK_FETCH_SUMMARY,
  MOCK_JOB,
  MOCK_JOB_DETAIL,
  MOCK_JOBS,
  MOCK_SKILL_RESULTS,
  MOCK_STATS,
  MOCK_RECOMMENDED_JOBS,
} from './canonicalMockJob';

export {
  CANONICAL_MOCK_JOB_IDS,
  MOCK_FETCH_SUMMARY,
  MOCK_JOB,
  MOCK_JOB_DETAIL,
  MOCK_JOBS,
  MOCK_SKILL_RESULTS,
  MOCK_STATS,
  MOCK_RECOMMENDED_JOBS,
};

export const MOCK_USER: User = {
  id: CANONICAL_MOCK_JOB_IDS.userId,
  name: 'Dev User',
  username: 'devuser',
  email: 'dev@NewCareers.ie',
  onboarded: true,
  role: 'ADMIN',
};

// ────────────────────────────────────────────────────────────────────────────────
// G14/G15 fix: mock data for the 9 formerly-orphaned api/ modules
// ────────────────────────────────────────────────────────────────────────────────

const { userJobId } = CANONICAL_MOCK_JOB_IDS;

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
    { id: 'sess-1', status: 'completed', jobTitle: MOCK_JOB.title, company: MOCK_JOB.company, appliedAt: new Date().toISOString(), outcome: 'submitted' },
  ],
  total: 1,
};

// networkingApi
export const MOCK_NETWORK_CONTACTS = {
  contacts: [
    { id: 'cnt-1', name: 'Jane Recruiter', email: 'jane@techwave.ie', linkedinUrl: null, company: MOCK_JOB.company, roleTitle: 'Talent Acquisition', contactType: 'recruiter', relationshipTemperature: 'warm', pipelineStage: 'outreached', notes: 'Met at Web Summit', linkedUserJobId: userJobId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastInteraction: null },
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
  pendingTasks: [
    {
      id: 'task-1',
      title: 'Prepare for TechWave interview',
      status: 'PENDING',
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
      userJobId,
    },
  ],
  upcomingEvents: [
    {
      id: 'dl-1',
      title: 'Submit assessment',
      eventDate: new Date(Date.now() + 86400000 * 3).toISOString(),
      eventType: 'CUSTOM',
      userJobId,
    },
  ],
  overdueTasks: [],
};

// progressApi
export const MOCK_WEEKLY_SUMMARY = {
  id: 'ws-1',
  weekStart: new Date(Date.now() - 86400000 * 6).toISOString(),
  weekEnd: new Date().toISOString(),
  jobsReviewed: 1,
  applicationsSubmitted: 0,
  interviewsScheduled: 0,
  responsesReceived: 0,
  offersReceived: 0,
  dailyUseStreak: 1,
  winsSummary: 'TechWave Senior Frontend role added to pipeline.',
  bottlenecksSummary: null,
  recommendations: 'Run evaluate and tailor-resume skills on the canonical mock job.',
  bestPerformingCategory: 'React roles',
  responseRate: 0,
  interviewRate: 0,
  createdAt: new Date().toISOString(),
};
export const MOCK_STREAKS = {
  currentDailyStreak: 1,
  longestDailyStreak: 1,
  lastActiveDate: new Date().toISOString(),
  totalJobsReviewed: 1,
  totalAppsSubmitted: 0,
  badges: [
    { key: 'first_app', label: 'First Application', icon: '🎉', earned: false },
    { key: 'week_streak', label: '7-Day Streak', icon: '🔥', earned: false },
  ],
};

// resumeVersionApi
export const MOCK_RESUME_VERSIONS = {
  versions: [
    { id: 'rv-1', name: 'Senior FE — Fintech Focus', versionNumber: 1, source: 'upload', roleTags: ['frontend', 'fintech'], isActive: true, isFavorite: true, outcomeAssociation: null, interviewCount: 0, applicationCount: 0, offerCount: 0, bestForRoleType: MOCK_JOB.title, notes: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  total: 1,
};

// watchlistApi
export const MOCK_WATCHLISTS = {
  watchlists: [
    { id: 'wl-1', name: 'Dublin Senior React Roles', queryKeywords: 'React TypeScript', location: 'Dublin', minSalary: 70000, maxSalary: null, remoteOnly: false, sponsorshipRequired: false, minMatchScore: 70, alertEmail: true, alertInApp: true, status: 'active', lastRunAt: new Date().toISOString(), matchedTotal: 1, clickedTotal: 0, appliedTotal: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  total: 1,
};

// workspaceApi
export const MOCK_WORKSPACES = [
  { id: 'ws-1', ownerId: CANONICAL_MOCK_JOB_IDS.userId, name: 'My Career Workspace', description: 'Personal review workspace', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), members: [] },
];
