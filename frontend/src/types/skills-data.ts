/**
 * types/skills-data.ts — specific interfaces for SkillRunResponse.data payloads
 */

export interface CompareRow {
  label: string;
  values: string[];
}

export interface CompareData {
  rationale?: string;
  winnerIndex?: number;
  rows?: CompareRow[];
}

export function isCompareData(value: unknown): value is CompareData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    rationale?: unknown;
    winnerIndex?: unknown;
    rows?: unknown;
  };

  return (candidate.rationale === undefined || typeof candidate.rationale === 'string')
    && (candidate.winnerIndex === undefined || typeof candidate.winnerIndex === 'number')
    && (candidate.rows === undefined || Array.isArray(candidate.rows));
}

export interface TriageItem {
  userJobId: string;
  rank?: number;
  title?: string;
  verdict?: string;
}

export interface TriageData {
  ranked?: TriageItem[];
}

export function isTriageData(value: unknown): value is TriageData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { ranked?: unknown };
  return candidate.ranked === undefined || Array.isArray(candidate.ranked);
}

export interface PrepInterviewQuestion {
  question: string;
  category?: string;
  starterAnswer?: string;
}

export interface PrepInterviewStudyItem {
  topic: string;
  why?: string;
  resource?: string;
}

export interface PrepInterviewData {
  likelyQuestions?: PrepInterviewQuestion[];
  talkingPoints?: string[];
  studyPlan?: PrepInterviewStudyItem[];
  questionsToAskInterviewer?: string[];
  redFlagsToAddress?: string[];
}

export interface ApplyAssistantQA {
  question: string;
  answer: string;
}

export interface ApplyAssistantData {
  coverLetter?: string;
  questionAnswers?: ApplyAssistantQA[];
  preSubmitChecklist?: string[];
}

export interface EvaluationPoint {
  label: string;
  score: number;
  reason: string;
}

export interface EvaluationSections {
  executiveSummary?: string;
  backgroundMatch?: string;
  positioningStrategy?: string;
  compensationAndMarket?: string;
  tailoringPlan?: string;
  interviewPrep?: string;
}

export interface EvaluationData {
  matchPercent?: number;
  overallScore?: number;
  verdict?: string;
  humanSummary?: string;
  matchedSkills?: string[];
  unmatchedSkills?: string[];
  cvImprovementTips?: string[];
  nextSteps?: string[];
  sections?: EvaluationSections;
}

export interface OutreachFormats {
  linkedInConnection?: string;
  linkedInMessage?: string;
  coldEmailSubject?: string;
  coldEmailBody?: string;
  followUp?: string;
}

export interface OutreachContactDraft {
  name: string;
  title?: string;
  whyThisPerson?: string;
  priority?: number;
  formats?: OutreachFormats;
}

export interface OutreachData {
  subject?: string;
  body?: string;
  rationale?: string;
  channel?: string;
  tone?: string;
  wordCount?: number;
  alternatives?: string[];
  company?: string;
  roleTitle?: string;
  contacts?: OutreachContactDraft[];
}

export interface ResearchData {
  company?: string;
  whatTheyDo?: string;
  culture?: string;
  salaryBenchmark?: Record<string, string>;
  greenFlags?: string[];
  redFlags?: string[];
  recentNews?: string[];
  interviewStyle?: string;
  questionsToAsk?: string[];
}
