import type { JobDetail } from '@/types';

import type { EvaluationData, EvaluationSections } from '@/types/skills-data';



export type EvaluationDimension = {

  key: string;

  label: string;

  score: number;

  weight?: number;

  reason?: string;

};



export type JobEvaluationView = EvaluationData & {

  sponsorshipMatch?: boolean;

  salaryMatch?: boolean;

  dimensionScores?: Record<string, number>;

  dimensions?: EvaluationDimension[];

  applyScore?: number;

  archetype?: string;

  schemaVersion?: number;

  legacy?: boolean;

  evaluationStatus?: string;

  /** True when evaluation came from daily job delivery / stored breakdown */

  fromDailyDelivery: boolean;

};



const V2_DIMENSION_KEYS: { key: string; label: string }[] = [

  { key: 'role_fit', label: 'Role fit' },

  { key: 'skills_match', label: 'Skills match' },

  { key: 'experience_depth', label: 'Experience depth' },

  { key: 'cv_evidence', label: 'CV evidence' },

  { key: 'location_work_model', label: 'Location & work model' },

  { key: 'compensation', label: 'Compensation' },

  { key: 'sponsorship_visa', label: 'Sponsorship / visa' },

  { key: 'company_stage', label: 'Company stage' },

  { key: 'growth_learning', label: 'Growth & learning' },

  { key: 'culture_signals', label: 'Culture signals' },

];



const SECTION_KEYS = new Set([

  'overallScore',

  'matchPercent',

  'matchedSkills',

  'unmatchedSkills',

  'sponsorshipMatch',

  'salaryMatch',

  'cvImprovementTips',

  'verdict',

  'humanSummary',

  'sections',

  'schemaVersion',

  'applyScore',

  'archetype',

  'evaluationStatus',

  'dimensions',

  'dimensionScores',

  'source',

  'generatedAt',

  'legacy',

]);



function asString(value: unknown): string | undefined {

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;

}



function asNumber(value: unknown): number | undefined {

  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;

}



function asStringArray(value: unknown): string[] | undefined {

  if (!Array.isArray(value)) return undefined;

  const items = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

  return items.length ? items : undefined;

}



function parseSections(value: unknown): EvaluationSections {

  if (!value || typeof value !== 'object') return {};

  const s = value as Record<string, unknown>;

  const out: EvaluationSections = {};

  const executiveSummary = asString(s.executiveSummary);

  const backgroundMatch = asString(s.backgroundMatch);

  const positioningStrategy = asString(s.positioningStrategy);

  const compensationAndMarket = asString(s.compensationAndMarket);

  const tailoringPlan = asString(s.tailoringPlan);

  const interviewPrep = asString(s.interviewPrep);

  if (executiveSummary) out.executiveSummary = executiveSummary;

  if (backgroundMatch) out.backgroundMatch = backgroundMatch;

  if (positioningStrategy) out.positioningStrategy = positioningStrategy;

  if (compensationAndMarket) out.compensationAndMarket = compensationAndMarket;

  if (tailoringPlan) out.tailoringPlan = tailoringPlan;

  if (interviewPrep) out.interviewPrep = interviewPrep;

  return out;

}



function parseDimensions(value: unknown): EvaluationDimension[] | undefined {

  if (!Array.isArray(value)) return undefined;

  const out: EvaluationDimension[] = [];

  for (const item of value) {

    if (!item || typeof item !== 'object') continue;

    const d = item as Record<string, unknown>;

    const key = asString(d.key);

    if (!key) continue;

    const score = asNumber(d.score);

    const dim: EvaluationDimension = {

      key,

      label: asString(d.label) ?? formatDimensionLabel(key),

      score: score ?? 0,

    };

    const weight = asNumber(d.weight);

    const reason = asString(d.reason);

    if (weight != null) dim.weight = weight;

    if (reason) dim.reason = reason;

    out.push(dim);

  }

  return out.length ? out : undefined;

}



/** Numeric dimension scores stored alongside section prose (e.g. technical: 94). */

function extractLegacyDimensionScores(raw: Record<string, unknown>): Record<string, number> | undefined {

  const scores: Record<string, number> = {};

  for (const [key, value] of Object.entries(raw)) {

    if (SECTION_KEYS.has(key)) continue;

    if (key === 'sections' && value && typeof value === 'object') {

      for (const [subKey, subVal] of Object.entries(value as Record<string, unknown>)) {

        if (typeof subVal === 'number' && Number.isFinite(subVal) && subVal <= 5) {

          scores[subKey] = subVal;

        }

      }

      continue;

    }

    if (typeof value === 'number' && Number.isFinite(value) && value <= 5) {

      scores[key] = value;

    }

  }

  return Object.keys(scores).length ? scores : undefined;

}



function dimensionsFromFlatScores(scores: Record<string, number>): EvaluationDimension[] {

  const known = new Set(V2_DIMENSION_KEYS.map(d => d.key));

  const ordered: EvaluationDimension[] = [];

  for (const def of V2_DIMENSION_KEYS) {

    const score = scores[def.key];

    if (score == null) continue;

    ordered.push({

      key: def.key,

      label: def.label,

      score: score > 5 ? Math.min(5, score / 20) : score,

      weight: 0.1,

    });

  }

  for (const [key, score] of Object.entries(scores)) {

    if (known.has(key)) continue;

    ordered.push({

      key,

      label: formatDimensionLabel(key),

      score: score > 5 ? Math.min(5, score / 20) : score,

    });

  }

  return ordered;

}



function syncDimensionScores(view: JobEvaluationView): void {

  if (view.dimensions?.length) {

    view.dimensionScores = Object.fromEntries(view.dimensions.map(d => [d.key, d.score]));

  }

}



/**

 * Parse a raw evaluation report (API / skill payload / score_breakdown JSON).

 */

export function parseEvaluationReport(

  raw: Record<string, unknown> | null | undefined,

  options?: { fromDailyDelivery?: boolean },

): JobEvaluationView | null {

  if (!raw || typeof raw !== 'object') return null;



  const sections = parseSections(raw.sections);

  const view: JobEvaluationView = {

    fromDailyDelivery: options?.fromDailyDelivery ?? true,

    matchedSkills: asStringArray(raw.matchedSkills) ?? [],

    unmatchedSkills: asStringArray(raw.unmatchedSkills) ?? [],

    cvImprovementTips: asStringArray(raw.cvImprovementTips) ?? [],

    sections,

  };



  const matchPercent = asNumber(raw.matchPercent);

  const overallScore = asNumber(raw.overallScore);

  const verdict = asString(raw.verdict);

  const humanSummary = asString(raw.humanSummary);

  if (matchPercent != null) view.matchPercent = matchPercent;

  if (overallScore != null) view.overallScore = overallScore;

  if (verdict) view.verdict = verdict;

  if (humanSummary) view.humanSummary = humanSummary;

  if (typeof raw.sponsorshipMatch === 'boolean') view.sponsorshipMatch = raw.sponsorshipMatch;

  if (typeof raw.salaryMatch === 'boolean') view.salaryMatch = raw.salaryMatch;



  const schemaVersion = asNumber(raw.schemaVersion);

  if (schemaVersion != null) view.schemaVersion = schemaVersion;

  const applyScore = asNumber(raw.applyScore);

  if (applyScore != null) view.applyScore = applyScore;

  const archetype = asString(raw.archetype);

  if (archetype) view.archetype = archetype;

  const evalStatus = asString(raw.evaluationStatus);

  if (evalStatus) view.evaluationStatus = evalStatus;



  const isV2 = schemaVersion != null && schemaVersion >= 2;

  view.legacy = !isV2;



  let dimensions = parseDimensions(raw.dimensions);

  if (!dimensions?.length) {

    const legacyScores = extractLegacyDimensionScores(raw);

    if (legacyScores) dimensions = dimensionsFromFlatScores(legacyScores);

  }

  if (dimensions?.length) {

    view.dimensions = dimensions;

    syncDimensionScores(view);

  }



  return view;

}



const HEURISTIC_PLACEHOLDER_TIP = 'Run a deep evaluation when AI capacity is available.';

export function isHeuristicPlaceholderEvaluation(job: JobDetail): boolean {
  const summary = (job.humanSummary ?? '').toLowerCase();
  if (summary.includes('heuristic') || summary.includes('rate-limited')) return true;
  const tips = job.cvImprovementTips ?? [];
  return tips.length === 1 && tips[0] === HEURISTIC_PLACEHOLDER_TIP;
}

export function hasActionableCvTips(job: JobDetail): boolean {
  const tips = job.cvImprovementTips ?? [];
  if (tips.length === 0) return false;
  return !isHeuristicPlaceholderEvaluation(job);
}

export function hasStoredJobEvaluation(job: JobDetail): boolean {

  return Boolean(

    job.scoreBreakdown ||

    job.humanSummary?.trim() ||

    job.verdict?.trim() ||

    (job.matchedSkills && job.matchedSkills.length > 0) ||

    hasActionableCvTips(job),

  );

}



export function resolveJobEvaluation(job: JobDetail): JobEvaluationView {

  const raw = job.scoreBreakdown;

  if (raw && typeof raw === 'object') {

    const parsed = parseEvaluationReport(raw as Record<string, unknown>, { fromDailyDelivery: true });

    if (parsed) return parsed;

  }



  const fallback: JobEvaluationView = {

    fromDailyDelivery: Boolean(job.humanSummary || job.verdict),

    matchedSkills: job.matchedSkills ?? [],

    unmatchedSkills: job.unmatchedSkills ?? [],

    cvImprovementTips: job.cvImprovementTips ?? [],

    sections: {},

  };

  if (job.matchPercent != null) fallback.matchPercent = job.matchPercent;

  if (job.aiScore != null) fallback.overallScore = job.aiScore;

  if (job.verdict) fallback.verdict = job.verdict;

  if (job.humanSummary) fallback.humanSummary = job.humanSummary;

  return fallback;

}



export function evaluationFromSkillPayload(

  data: Record<string, unknown> | null | undefined,

  job: JobDetail,

): JobEvaluationView | null {

  if (!data) return null;

  const merged: JobDetail = { ...job, scoreBreakdown: data };

  const matchPercent = asNumber(data.matchPercent);

  const overallScore = asNumber(data.overallScore);

  const verdict = asString(data.verdict);

  const humanSummary = asString(data.humanSummary);

  const matchedSkills = asStringArray(data.matchedSkills);

  const unmatchedSkills = asStringArray(data.unmatchedSkills);

  const cvImprovementTips = asStringArray(data.cvImprovementTips);

  if (matchPercent != null) merged.matchPercent = matchPercent;

  if (overallScore != null) merged.aiScore = overallScore;

  if (verdict) merged.verdict = verdict;

  if (humanSummary) merged.humanSummary = humanSummary;

  if (matchedSkills) merged.matchedSkills = matchedSkills;

  if (unmatchedSkills) merged.unmatchedSkills = unmatchedSkills;

  if (cvImprovementTips) merged.cvImprovementTips = cvImprovementTips;

  const parsed = parseEvaluationReport(data, { fromDailyDelivery: false });

  if (parsed) {

    parsed.fromDailyDelivery = false;

    return parsed;

  }

  return resolveJobEvaluation(merged);

}



export function formatDimensionLabel(key: string): string {

  return key

    .replace(/([A-Z])/g, ' $1')

    .replace(/_/g, ' ')

    .trim()

    .replace(/\b\w/g, c => c.toUpperCase());

}



/** Prefer V2 dimension rows; fall back to legacy score map as synthetic dimensions. */

export function evaluationDimensionsForDisplay(

  evaluation: JobEvaluationView,

): EvaluationDimension[] {

  if (evaluation.dimensions?.length) return evaluation.dimensions;

  if (evaluation.dimensionScores && Object.keys(evaluation.dimensionScores).length > 0) {

    return dimensionsFromFlatScores(evaluation.dimensionScores);

  }

  return [];

}


