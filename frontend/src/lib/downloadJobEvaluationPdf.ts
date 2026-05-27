import type { JobDetail } from '@/types';import { EVALUATION_ADVISORY_FOOTER } from '@/lib/evaluationDisclaimers';

import type { JobEvaluationView } from '@/lib/jobEvaluation';

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

  archetype?: string;  disclaimer?: string;

  sections?: {

    executiveSummary?: string;

    backgroundMatch?: string;

    positioningStrategy?: string;

    compensationAndMarket?: string;

    tailoringPlan?: string;

    interviewPrep?: string;

  };

};



function sectionsPayload(sections?: EvaluationSections): JobEvaluationPdfPayload['sections'] {

  if (!sections) return undefined;

  const out: NonNullable<JobEvaluationPdfPayload['sections']> = {};

  if (sections.executiveSummary) out.executiveSummary = sections.executiveSummary;

  if (sections.backgroundMatch) out.backgroundMatch = sections.backgroundMatch;

  if (sections.positioningStrategy) out.positioningStrategy = sections.positioningStrategy;

  if (sections.compensationAndMarket) out.compensationAndMarket = sections.compensationAndMarket;

  if (sections.tailoringPlan) out.tailoringPlan = sections.tailoringPlan;

  if (sections.interviewPrep) out.interviewPrep = sections.interviewPrep;

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
  const out: JobEvaluationPdfPayload = { ...payload };

  if (out.matchPercent != null) {
    const n = finiteScore(out.matchPercent);
    if (n != null) out.matchPercent = Math.round(n);
    else delete out.matchPercent;
  }
  if (out.overallScore != null) {
    const n = finiteScore(out.overallScore);
    if (n != null) out.overallScore = Math.round(n);
    else delete out.overallScore;
  }
  if (out.applyScore != null) {
    const n = finiteScore(out.applyScore);
    if (n != null) out.applyScore = n;
    else delete out.applyScore;
  }

  if (out.dimensions?.length) {
    out.dimensions = out.dimensions.map(d => {
      const score = finiteScore(d.score) ?? 0;
      const row: JobEvaluationPdfDimension = { key: d.key, label: d.label, score };
      const weight = finiteScore(d.weight);
      if (weight != null) row.weight = weight;
      if (d.reason) row.reason = d.reason;
      return row;
    });
    delete out.dimensionScores;
  } else if (out.dimensionScores) {
    const scores: Record<string, number> = {};
    for (const [key, value] of Object.entries(out.dimensionScores)) {
      const n = finiteScore(value);
      if (n != null) scores[key] = n;
    }
    if (Object.keys(scores).length) out.dimensionScores = scores;
    else delete out.dimensionScores;
  }

  return out;
}export function buildJobEvaluationPdfPayload(
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
    disclaimer: EVALUATION_ADVISORY_FOOTER,
  };



  if (evaluation.matchPercent != null) payload.matchPercent = evaluation.matchPercent;

  if (evaluation.overallScore != null) payload.overallScore = evaluation.overallScore;

  if (evaluation.verdict) payload.verdict = evaluation.verdict;

  if (evaluation.humanSummary) payload.humanSummary = evaluation.humanSummary;

  if (evaluation.applyScore != null) payload.applyScore = evaluation.applyScore;

  if (evaluation.archetype) payload.archetype = evaluation.archetype;

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

