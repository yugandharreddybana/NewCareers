import { JobCard, User } from '@/types';
import { NetworkContact } from '@/api/networkingApi';
import { AnalyticsSummary, FunnelStage, TimeSeriesPoint } from '@/services/analyticsApi';

export interface SkillSession {
  userJobId: string;
  jobTitle: string;
  company: string;
  skillName: any;
  state: any;
  ranAt?: string;
  result?: string;
}

export const DUMMY_USER: User = {
  id: 'dev-user-123',
  name: 'Dev Tester',
  username: 'devtester',
  email: 'dev@careerops.ie',
  onboarded: true,
};

export const DUMMY_JOBS_LIST: JobCard[] = [
  {
    jobId: 'j-1',
    userJobId: 'uj-1',
    title: 'Senior Frontend Engineer (React)',
    company: 'TechWave Ireland',
    location: 'Dublin (Hybrid)',
    salaryMin: 75000,
    salaryMax: 95000,
    matchPercent: 92,
    sourceName: 'LinkedIn',
    kanbanColumn: 'Discovered',
    status: 'saved',
    sourceUrl: 'https://example.com',
    matchedSkills: ['React', 'TypeScript', 'Tailwind CSS', 'Redux'],
    unmatchedSkills: ['GraphQL'],
  },
  {
    jobId: 'j-2',
    userJobId: 'uj-2',
    title: 'Lead Full Stack Developer',
    company: 'EcoGrowth',
    location: 'Cork (Remote)',
    salaryMin: 80000,
    salaryMax: 110000,
    matchPercent: 85,
    sourceName: 'IrishJobs',
    kanbanColumn: 'Discovered',
    status: 'saved',
    sourceUrl: 'https://example.com',
    matchedSkills: ['Node.js', 'React', 'PostgreSQL'],
    unmatchedSkills: ['Docker'],
  },
  {
    jobId: 'j-3',
    userJobId: 'uj-3',
    title: 'Frontend Developer',
    company: 'SkyData',
    location: 'Galway (Hybrid)',
    salaryMin: 55000,
    salaryMax: 70000,
    matchPercent: 88,
    sourceName: 'Jobs.ie',
    kanbanColumn: 'Saved',
    status: 'saved',
    sourceUrl: 'https://example.com',
    matchedSkills: ['React', 'JavaScript', 'CSS'],
    unmatchedSkills: [],
  },
];

export const DUMMY_SESSIONS: SkillSession[] = [
  {
    userJobId: 'uj-1',
    jobTitle: 'Senior Frontend Engineer (React)',
    company: 'TechWave Ireland',
    skillName: 'evaluate',
    state: 'done',
    ranAt: new Date().toISOString(),
    result: 'Based on your experience, you have a 92% match score for this role. Key skills like React and TypeScript are fully matched. We recommend addressing GraphQL in your profile.'
  },
  {
    userJobId: 'uj-1',
    jobTitle: 'Senior Frontend Engineer (React)',
    company: 'TechWave Ireland',
    skillName: 'tailor-resume',
    state: 'idle'
  },
  {
    userJobId: 'uj-1',
    jobTitle: 'Senior Frontend Engineer (React)',
    company: 'TechWave Ireland',
    skillName: 'research',
    state: 'idle'
  },
];

export const DUMMY_CONTACTS: NetworkContact[] = [
  {
    id: 'c-1',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@techwave.ie',
    linkedinUrl: 'https://linkedin.com/in/sarahjenkins',
    company: 'TechWave Ireland',
    roleTitle: 'Technical Recruiter',
    contactType: 'recruiter',
    relationshipTemperature: 'warm',
    pipelineStage: 'connected',
    notes: 'Very responsive about front-end roles.',
    linkedUserJobId: 'uj-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastInteraction: {
      id: 'i-1',
      interactionType: 'linkedin_message',
      outcome: 'positive',
      nextStep: 'Send tailored resume',
      nextStepDueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
  },
  {
    id: 'c-2',
    name: 'Michael Chen',
    email: 'mchen@ecogrowth.com',
    linkedinUrl: 'https://linkedin.com/in/michaelchen',
    company: 'EcoGrowth',
    roleTitle: 'Engineering Manager',
    contactType: 'hiring_manager',
    relationshipTemperature: 'cold',
    pipelineStage: 'identified',
    notes: 'Looking to hire Full Stack developers.',
    linkedUserJobId: 'uj-2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastInteraction: null
  }
];

export const DUMMY_SUMMARY: AnalyticsSummary = {
  skillsRunThisWeek: 4,
  applicationsSubmitted: 12,
  avgMatchPercent: 82,
  skillUsage: [
    { skill: 'Resume Match', count: 8 },
    { skill: 'Outreach Generator', count: 5 },
    { skill: 'Interview Coach', count: 3 },
  ]
};

export const DUMMY_FUNNEL: FunnelStage[] = [
  { stage: 'Discovered', count: 18 },
  { stage: 'Saved',      count: 12 },
  { stage: 'Applied',    count: 8 },
  { stage: 'Interview',  count: 3 },
  { stage: 'Offer',      count: 1 },
  { stage: 'Rejected',   count: 2 },
];

export const DUMMY_TIME_SERIES: TimeSeriesPoint[] = [
  { week: '2026-04-01', applications: 2, matchAvg: 75 },
  { week: '2026-04-08', applications: 3, matchAvg: 78 },
  { week: '2026-04-15', applications: 5, matchAvg: 82 },
  { week: '2026-04-22', applications: 4, matchAvg: 80 },
  { week: '2026-04-29', applications: 6, matchAvg: 85 },
];
