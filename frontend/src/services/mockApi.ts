import { User, JobCard, JobDetail, FetchSummary, Stats } from '@/types';

export const MOCK_USER: User = {
  id: 'dev-user-123',
  name: 'Dev Tester',
  username: 'devtester',
  email: 'dev@careerops.ie',
  onboarded: true,
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
  ...MOCK_JOBS[0],
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

export const MOCK_SKILL_RESULTS: Record<string, any> = {
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
