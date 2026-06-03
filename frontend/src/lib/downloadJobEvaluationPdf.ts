import type { JobDetail } from '@/types';
import { applyGate } from '@/lib/evaluationApplyGate';
import { EVALUATION_ADVISORY_FOOTER } from '@/lib/evaluationDisclaimers';
import { resolveNextStepsForDisplay, type JobEvaluationView } from '@/lib/jobEvaluation';
import type { EvaluationSections } from '@/types/skills-data';

export type JobEvaluationPdfDimension = {
  key: string;
  label: string;
  score: number;
  weight?: number;
  reason?: string;
};

export type JobEvaluationPdfPayload = {
  title: string;
  company: string;
  location: string;
  matchPercent?: number;
  overallScore?: number;
  verdict?: string;
  humanSummary?: string;
  matchedSkills?: string[];
  unmatchedSkills?: string[];
  cvImprovementTips?: string[];
  dimensionScores?: Record<string, number>;
  dimensions?: JobEvaluationPdfDimension[];
  applyScore?: number;
  archetype?: string;
  applyGateMessage?: string;
  nextSteps?: string[];
  storyBankCandidates?: string[];
  sponsorshipMatch?: boolean;
  salaryMatch?: boolean;
  disclaimer?: string;
  sections?: {
    executiveSummary?: string;
    backgroundMatch?: string;
    positioningStrategy?: string;
    compensationAndMarket?: string;
    tailoringPlan?: string;
    interviewPrep?: string;
  };
};

const PDF_TEXT_MAX = 12_000;

/** Strip control chars and cap length so Jackson never sees truncated/invalid JSON strings. */
function sanitizePdfText(value: string | undefined, maxLen = PDF_TEXT_MAX): string | undefined {
  if (value == null) return undefined;
  const cleaned = value
    .replace(/\u0000/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, ' ')
    // Drop lone UTF-16 surrogates that can break downstream UTF-8 JSON decoding.
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .trim();
  if (!cleaned) return undefined;
  // Slice by code points so we never split surrogate pairs.
  const points = Array.from(cleaned);
  if (points.length <= maxLen) return cleaned;
  return points.slice(0, maxLen).join('');
}

function sanitizeStringList(items?: string[]): string[] | undefined {
  if (!items?.length) return undefined;
  const out = items
    .map(item => sanitizePdfText(item, 2000))
    .filter((item): item is string => Boolean(item));
  return out.length ? out : undefined;
}

function sectionsPayload(sections?: EvaluationSections): JobEvaluationPdfPayload['sections'] {
  if (!sections) return undefined;
  const out: NonNullable<JobEvaluationPdfPayload['sections']> = {};
  const executiveSummary = sanitizePdfText(sections.executiveSummary);
  const backgroundMatch = sanitizePdfText(sections.backgroundMatch);
  const positioningStrategy = sanitizePdfText(sections.positioningStrategy);
  const compensationAndMarket = sanitizePdfText(sections.compensationAndMarket);
  const tailoringPlan = sanitizePdfText(sections.tailoringPlan);
  const interviewPrep = sanitizePdfText(sections.interviewPrep);
  if (executiveSummary) out.executiveSummary = executiveSummary;
  if (backgroundMatch) out.backgroundMatch = backgroundMatch;
  if (positioningStrategy) out.positioningStrategy = positioningStrategy;
  if (compensationAndMarket) out.compensationAndMarket = compensationAndMarket;
  if (tailoringPlan) out.tailoringPlan = tailoringPlan;
  if (interviewPrep) out.interviewPrep = interviewPrep;
  return Object.keys(out).length ? out : undefined;
}

function finiteScore(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Coerce scores for Java PDF DTO (Integer match/overall, Double dimensions). */
export function sanitizeJobEvaluationPdfPayload(
  payload: JobEvaluationPdfPayload,
): JobEvaluationPdfPayload {
  const out: JobEvaluationPdfPayload = {
    title: sanitizePdfText(payload.title, 500) ?? 'Job',
    company: sanitizePdfText(payload.company, 500) ?? '',
    location: sanitizePdfText(payload.location, 500) ?? '',
  };

  if (payload.matchPercent != null) {
    const n = finiteScore(payload.matchPercent);
    if (n != null) out.matchPercent = Math.round(n);
  }
  if (payload.overallScore != null) {
    const n = finiteScore(payload.overallScore);
    if (n != null) out.overallScore = Math.round(n);
  }
  if (payload.applyScore != null) {
    const n = finiteScore(payload.applyScore);
    if (n != null) out.applyScore = n;
  }

  const verdict = sanitizePdfText(payload.verdict, 500);
  if (verdict) out.verdict = verdict;
  const humanSummary = sanitizePdfText(payload.humanSummary);
  if (humanSummary) out.humanSummary = humanSummary;
  const archetype = sanitizePdfText(payload.archetype, 200);
  if (archetype) out.archetype = archetype;
  const disclaimer = sanitizePdfText(payload.disclaimer);
  if (disclaimer) out.disclaimer = disclaimer;
  const applyGateMessage = sanitizePdfText(payload.applyGateMessage, 500);
  if (applyGateMessage) out.applyGateMessage = applyGateMessage;

  const matchedSkills = sanitizeStringList(payload.matchedSkills);
  if (matchedSkills) out.matchedSkills = matchedSkills;
  const unmatchedSkills = sanitizeStringList(payload.unmatchedSkills);
  if (unmatchedSkills) out.unmatchedSkills = unmatchedSkills;
  const cvImprovementTips = sanitizeStringList(payload.cvImprovementTips);
  if (cvImprovementTips) out.cvImprovementTips = cvImprovementTips;
  const nextSteps = sanitizeStringList(payload.nextSteps);
  if (nextSteps) out.nextSteps = nextSteps;
  const storyBankCandidates = sanitizeStringList(payload.storyBankCandidates);
  if (storyBankCandidates) out.storyBankCandidates = storyBankCandidates;

  if (payload.sponsorshipMatch != null) out.sponsorshipMatch = payload.sponsorshipMatch;
  if (payload.salaryMatch != null) out.salaryMatch = payload.salaryMatch;

  if (payload.dimensions?.length) {
    out.dimensions = payload.dimensions.map(d => {
      const score = finiteScore(d.score) ?? 0;
      const row: JobEvaluationPdfDimension = {
        key: sanitizePdfText(d.key, 120) ?? d.key,
        label: sanitizePdfText(d.label, 200) ?? d.label,
        score,
      };
      const weight = finiteScore(d.weight);
      if (weight != null) row.weight = weight;
      const reason = sanitizePdfText(d.reason, 2000);
      if (reason) row.reason = reason;
      return row;
    });
  } else if (payload.dimensionScores) {
    const scores: Record<string, number> = {};
    for (const [key, value] of Object.entries(payload.dimensionScores)) {
      const n = finiteScore(value);
      if (n != null) scores[key] = n;
    }
    if (Object.keys(scores).length) out.dimensionScores = scores;
  }

  const sections = sectionsPayload(payload.sections as EvaluationSections | undefined);
  if (sections) out.sections = sections;

  JSON.parse(JSON.stringify(out));

  return out;
}

export function buildJobEvaluationPdfPayload(
  job: JobDetail,
  evaluation: JobEvaluationView,
): JobEvaluationPdfPayload {
  const payload: JobEvaluationPdfPayload = {
    title: job.title,
    company: job.company,
    location: job.location,
    matchedSkills: evaluation.matchedSkills ?? [],
    unmatchedSkills: evaluation.unmatchedSkills ?? [],
    cvImprovementTips: evaluation.cvImprovementTips ?? [],
    nextSteps: resolveNextStepsForDisplay(evaluation),
    disclaimer: EVALUATION_ADVISORY_FOOTER,
  };

  if (evaluation.matchPercent != null) payload.matchPercent = evaluation.matchPercent;
  if (evaluation.overallScore != null) payload.overallScore = evaluation.overallScore;
  if (evaluation.verdict) payload.verdict = evaluation.verdict;
  if (evaluation.humanSummary) payload.humanSummary = evaluation.humanSummary;
  if (evaluation.applyScore != null) {
    payload.applyScore = evaluation.applyScore;
    payload.applyGateMessage = applyGate(evaluation.applyScore).message;
  }
  if (evaluation.archetype) payload.archetype = evaluation.archetype;
  if (evaluation.sponsorshipMatch != null) payload.sponsorshipMatch = evaluation.sponsorshipMatch;
  if (evaluation.salaryMatch != null) payload.salaryMatch = evaluation.salaryMatch;
  if (evaluation.storyBankCandidates?.length) {
    payload.storyBankCandidates = evaluation.storyBankCandidates;
  }

  if (evaluation.dimensions?.length) {
    payload.dimensions = evaluation.dimensions.map(d => {
      const row: JobEvaluationPdfDimension = {
        key: d.key,
        label: d.label,
        score: d.score,
      };
      if (d.weight != null) row.weight = d.weight;
      if (d.reason) row.reason = d.reason;
      return row;
    });
  } else if (evaluation.dimensionScores && Object.keys(evaluation.dimensionScores).length > 0) {
    payload.dimensionScores = evaluation.dimensionScores;
  }

  const sections = sectionsPayload(evaluation.sections);
  if (sections) payload.sections = sections;

  return sanitizeJobEvaluationPdfPayload(payload);
}

export function jobEvaluationPdfFilename(job: JobDetail): string {
  const slug = `${job.company}-${job.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `job-evaluation-${slug || 'report'}.pdf`;
}
