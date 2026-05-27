import type { SkillName } from '@/types/skills';

export type SkillScope = 'job' | 'pipeline' | 'profile';

export interface SkillCatalogItem {
  id: SkillName;
  label: string;
  icon: string;
  /** Short line shown on the skill card. */
  description: string;
  /** Fuller explanation shown in the help tooltip (hover/focus on ? icon). */
  tooltip: string;
  scope: SkillScope;
  scopeHint?: string;
}

/** Canonical list of all 16 CareerOps skills (matches backend ALL_SKILLS + public/stats). */
export const SKILL_CATALOG: SkillCatalogItem[] = [
  {
    id: 'evaluate',
    label: 'Job Evaluation',
    icon: 'balance',
    description: 'View the AI evaluation from your daily job match — open for full detail.',
    tooltip:
      'CareerOps evaluates each role automatically when jobs are delivered to your pipeline (daily fetch). Click to open the full report: strengths, gaps, CV fixes, positioning, compensation notes, and interview prep. You can download it as a PDF or run a fresh deep evaluation if needed.',
    scope: 'job',
  },
  {
    id: 'tailor-resume',
    label: 'Tailor My CV',
    icon: 'description',
    description: 'Role-specific CV rewrite with a clear before/after view.',
    tooltip:
      'Rewrites your CV for this exact job description—not a generic polish. You get a side-by-side view of your baseline CV versus a tailored version with keywords, achievements, and phrasing aligned to what the employer asked for. Download the result as PDF when you are ready to apply.',
    scope: 'job',
  },
  {
    id: 'cover-letter',
    label: 'Cover Letter',
    icon: 'mail',
    description: 'Personalised letter matched to the company and role.',
    tooltip:
      'Drafts a complete cover letter using this job posting, your profile, and the employer context. Highlights what makes you credible for the role, suggests tone (e.g. professional vs conversational), and calls out personalisation hooks you can edit before sending.',
    scope: 'job',
  },
  {
    id: 'research',
    label: 'Research Company',
    icon: 'domain',
    description: 'Employer briefing: culture, news, pay, and risk flags.',
    tooltip:
      'Builds a research brief on the hiring company: what they do, team culture signals, recent news, typical salary bands for this kind of role, and explicit red or green flags. Helps you walk into applications and interviews sounding informed—not surprised.',
    scope: 'job',
  },
  {
    id: 'outreach',
    label: 'Draft Outreach',
    icon: 'send',
    description: 'Short LinkedIn or email message to a hiring contact.',
    tooltip:
      'Writes a concise outreach message (LinkedIn connection note, cold email, or polite follow-up) that references this role and your relevant experience. Stays specific to the company and title so it does not read like a mass template. Edit in place before you send.',
    scope: 'job',
  },
  {
    id: 'apply',
    label: 'Apply Assistant',
    icon: 'rocket_launch',
    description: 'Step-by-step help through the application itself.',
    tooltip:
      'Guides you through applying to this posting: suggested cover letter snippets, answers to common application form questions, and a pre-submit checklist (documents, links, consistency with your CV). Reduces last-minute gaps when portals ask for free-text responses.',
    scope: 'job',
  },
  {
    id: 'prep-interview',
    label: 'Interview Prep',
    icon: 'mic',
    description: 'Questions, talking points, and a study plan for this role.',
    tooltip:
      'Generates an interview kit for this job: likely technical and behavioural questions, bullet talking points tied to your background, a short study plan, and smart questions you should ask the panel. Calibrated to the seniority and domain in the posting.',
    scope: 'job',
  },
  {
    id: 'salary-negotiation',
    label: 'Salary Negotiation',
    icon: 'payments',
    description: 'Ranges, opening ask, counters, and negotiation scripts.',
    tooltip:
      'Estimates a realistic salary band for this role and location, then suggests an opening ask, target figure, and walk-away floor. Includes ready-to-use phrases for counteroffers and context on market norms so you can negotiate with numbers—not guesswork.',
    scope: 'job',
  },
  {
    id: 'culture-fit',
    label: 'Culture Fit',
    icon: 'groups',
    description: 'How well the company culture matches your preferences.',
    tooltip:
      'Scores how this employer’s culture likely aligns with your stated values and work style (e.g. pace, autonomy, collaboration). Breaks down dimensions with insights plus clear green flags (good signals) and red flags (misalignment risks) before you commit time to the process.',
    scope: 'job',
  },
  {
    id: 'linkedin-optimize',
    label: 'LinkedIn Optimize',
    icon: 'link',
    description: 'Headline, about, and bullets tuned for this target role.',
    tooltip:
      'Rewrites your LinkedIn headline, About section, and selected experience bullets so recruiters searching for this type of role see relevant keywords and outcomes. Shows current vs suggested text and adds role-specific keywords you may be missing.',
    scope: 'job',
  },
  {
    id: 'skills-gap-plan',
    label: 'Skills Gap Plan',
    icon: 'school',
    description: 'What to learn next, with courses and 30/60/90-day goals.',
    tooltip:
      'Compares your profile to this job’s requirements and lists concrete skill gaps ranked by priority. For each gap you get course suggestions (platform, title, time), weekly effort estimates, and 30/60/90-day milestones so you know what to improve if you are not ready to apply yet.',
    scope: 'job',
  },
  {
    id: 'scan',
    label: 'Profile Scan',
    icon: 'document_scanner',
    description: 'Check your profile against this role before you apply.',
    tooltip:
      'Audits your CareerOps profile (skills, experience, preferences) against this posting and surfaces mismatches early—missing keywords, weak areas, or misaligned seniority. Use it to decide whether to tailor your CV, update your profile, or skip roles that are a stretch.',
    scope: 'profile',
  },
  {
    id: 'compare',
    label: 'Compare Jobs',
    icon: 'compare_arrows',
    description: 'Compare this role with other saved jobs side by side.',
    tooltip:
      'Places this job next to up to four other roles already in your pipeline. Compares fit, compensation signals, growth potential, culture, sponsorship, and other factors in one view so you can choose where to spend applications and prep time.',
    scope: 'pipeline',
    scopeHint: 'Uses up to 5 saved roles including this one',
  },
  {
    id: 'triage',
    label: 'Triage Pipeline',
    icon: 'sort',
    description: 'Re-rank all saved jobs with verdicts and next steps.',
    tooltip:
      'Reviews every job in your pipeline and returns a prioritised list with a one-line verdict per role (e.g. apply now, nurture, or pass) plus suggested next actions. Best when you have many openings and need a clear order of attack—not just analysis of a single posting.',
    scope: 'pipeline',
    scopeHint: 'Runs across your full pipeline',
  },
  {
    id: 'track',
    label: 'Application Tracker',
    icon: 'view_kanban',
    description: 'Snapshot of saved applications and pipeline stats.',
    tooltip:
      'Returns a quick read of every role in your pipeline—status, match %, and aggregate counts (applied, interviews, offers). Use it before opening the Kanban board when you want numbers in one place.',
    scope: 'pipeline',
    scopeHint: 'All saved roles',
  },
  {
    id: 'help',
    label: 'Skill Directory',
    icon: 'help',
    description: 'Lists available skills and suggests your next step.',
    tooltip:
      'Shows the full CareerOps skill catalog with short descriptions and a personalized suggestion based on your CV and saved jobs—handy when you are not sure which skill to run next.',
    scope: 'profile',
  },
];

export const SKILL_COUNT = SKILL_CATALOG.length;

export function getSkillCatalogItem(id: SkillName): SkillCatalogItem | undefined {
  return SKILL_CATALOG.find(s => s.id === id);
}
