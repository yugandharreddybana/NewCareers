import type { JobDetail } from '@/types';
import { buildAtsKeywords, partitionAtsKeywords } from '@/lib/atsKeywords';
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

  storyBankCandidates?: string[];

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

  'nextSteps',

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

    nextSteps: asStringArray(raw.nextSteps) ?? [],

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

  const storyBankCandidates = asStringArray(raw.storyBankCandidates);
  if (storyBankCandidates) view.storyBankCandidates = storyBankCandidates;



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

/** Substantive report with dimension rubric + narrative sections (local or AI). */
/** Next-step bullets shown in the evaluation modal and PDF export. */
export function resolveNextStepsForDisplay(evaluation: JobEvaluationView): string[] {
  if ((evaluation.nextSteps?.length ?? 0) > 0) return evaluation.nextSteps ?? [];

  const score5 = evaluation.applyScore;
  const score100 = evaluation.overallScore;
  const normalized = score5 != null ? score5 : score100 != null ? score100 / 20 : undefined;

  if (normalized == null) {
    return ['Run a full evaluation to get tailored next steps and A–F guidance.'];
  }
  if (normalized >= 4.5) {
    return ['Strong match. Tailor your resume for this role and apply now.'];
  }
  if (normalized >= 3.0) {
    return ['Solid fit. Tailor your resume and emphasize your strongest matched signals before applying.'];
  }
  return ['This role is a stretch. Prioritize better-matched roles unless this is strategically important.'];
}

export function hasRichEvaluationReport(evaluation?: JobEvaluationView | null): boolean {
  if (!evaluation) return false;
  const summary = evaluation.sections?.executiveSummary?.trim() ?? '';
  const dimCount = evaluation.dimensions?.length ?? 0;
  if (summary.length >= 80 && dimCount >= 8) return true;
  if (summary.length >= 120 && dimCount >= 4) return true;
  return false;
}

export function isHeuristicPlaceholderEvaluation(job: JobDetail): boolean {
  const breakdown = job.scoreBreakdown as Record<string, unknown> | undefined;
  if (breakdown?.evaluationStatus === 'complete_local' || breakdown?.evaluationStatus === 'complete') {
    return false;
  }
  if (hasRichEvaluationReport(parseEvaluationReport(breakdown, { fromDailyDelivery: true }) ?? undefined)) {
    return false;
  }
  if (breakdown?.evaluationStatus === 'heuristic_preview') return true;
  const summary = (job.humanSummary ?? '').toLowerCase();
  if (summary.includes('run full job evaluation')) return true;
  const tips = job.cvImprovementTips ?? [];
  return tips.length === 1 && tips[0] === HEURISTIC_PLACEHOLDER_TIP;
}

export function isPreviewEvaluation(job: JobDetail, evaluation?: JobEvaluationView): boolean {
  if (evaluation?.evaluationStatus === 'complete_local' || evaluation?.evaluationStatus === 'complete') {
    return false;
  }
  if (hasRichEvaluationReport(evaluation)) return false;
  if ((evaluation?.dimensions?.length ?? 0) >= 4) return false;
  const breakdown = job.scoreBreakdown as Record<string, unknown> | undefined;
  if (breakdown?.evaluationStatus === 'complete_local' || breakdown?.evaluationStatus === 'complete') {
    return false;
  }
  if (Array.isArray(breakdown?.dimensions) && (breakdown.dimensions as unknown[]).length >= 4) {
    return false;
  }
  if (evaluation?.evaluationStatus === 'heuristic_preview') return true;
  return isHeuristicPlaceholderEvaluation(job);
}

/** True only when report matches full EvaluationReportV2 richness expected by SKILL.md. */
export function hasCompleteEvaluationReport(evaluation?: JobEvaluationView | null): boolean {
  if (!evaluation) return false;

  const status = (evaluation.evaluationStatus ?? '').toLowerCase();
  const statusOk = status === 'complete' || status === 'complete_local';

  const dimsOk = (evaluation.dimensions?.length ?? 0) >= 10;
  const sections = evaluation.sections ?? {};
  const sectionsOk =
    Boolean(sections.executiveSummary?.trim()) &&
    Boolean(sections.backgroundMatch?.trim()) &&
    Boolean(sections.positioningStrategy?.trim()) &&
    Boolean(sections.compensationAndMarket?.trim()) &&
    Boolean(sections.tailoringPlan?.trim()) &&
    Boolean(sections.interviewPrep?.trim());

  return statusOk && dimsOk && sectionsOk;
}

/** Fill keyword-based gaps when stored evaluation is preview-only. */
export function enrichPreviewEvaluation(
  job: JobDetail,
  profile?: { techStack?: string[]; targetRoles?: string[]; atsKeywords?: string[] } | null,
  baseView?: JobEvaluationView,
): JobEvaluationView {
  const base = overlayPersistedJobSkills(baseView ?? resolveJobEvaluation(job), job);
  const hasPersistedMatched = (job.matchedSkills?.length ?? 0) > 0;
  const hasPersistedUnmatched = (job.unmatchedSkills?.length ?? 0) > 0;
  if (hasPersistedMatched && hasPersistedUnmatched) {
    return base;
  }
  if (hasPersistedMatched && !isPreviewEvaluation(job, base) && (base.unmatchedSkills?.length ?? 0) > 0) {
    return base;
  }
  const matchedCount = base.matchedSkills?.length ?? 0;
  const gapCount = base.unmatchedSkills?.length ?? 0;
  if (!isPreviewEvaluation(job, base) && matchedCount > 1 && gapCount > 0) {
    return base;
  }

  const keywords = buildAtsKeywords(profile);
  if (!keywords.length) return base;

  const haystack = `${job.title ?? ''}\n${job.description ?? ''}`;
  const { matched, unmatched } = partitionAtsKeywords(haystack, keywords);
  if (!matched.length && !unmatched.length) return base;

  const tips = [...(base.cvImprovementTips ?? [])];
  for (const gap of unmatched) {
    const tip = `Develop or surface evidence for ${gap} — not mentioned in this posting.`;
    if (!tips.includes(tip)) tips.push(tip);
  }

  const previewBackgroundMatch =
    base.sections?.backgroundMatch
    ?? (matched.length ? `Profile skills found in posting: ${matched.join(', ')}.` : undefined);
  const previewPositioningStrategy =
    base.sections?.positioningStrategy
    ?? (unmatched.length ? `Close skill gaps in your CV or cover letter: ${unmatched.join(', ')}.` : undefined);
  const previewTailoringPlan =
    base.sections?.tailoringPlan
    ?? (matched.length
      ? `Mirror posting language for ${matched.join(', ')}${
        unmatched.length ? `; add proof points for ${unmatched.join(', ')}` : ''
      }.`
      : undefined);

  return {
    ...base,
    ...((matched.length && (base.matchedSkills?.length ?? 0) === 0)
      ? { matchedSkills: matched }
      : (base.matchedSkills ? { matchedSkills: base.matchedSkills } : {})),
    ...(tips.length
      ? { cvImprovementTips: tips }
      : (base.cvImprovementTips ? { cvImprovementTips: base.cvImprovementTips } : {})),
    sections: {
      ...base.sections,
      ...(previewBackgroundMatch ? { backgroundMatch: previewBackgroundMatch } : {}),
      ...(previewPositioningStrategy ? { positioningStrategy: previewPositioningStrategy } : {}),
      ...(previewTailoringPlan ? { tailoringPlan: previewTailoringPlan } : {}),
    },
  };
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



/** Full evaluation modal: narrative enrichment + API skill lists for chips. */
export function buildJobEvaluationView(
  job: JobDetail,
  profile?: { techStack?: string[]; targetRoles?: string[]; atsKeywords?: string[] } | null,
): JobEvaluationView {
  const base = resolveJobEvaluation(job);
  const enriched = enrichPreviewEvaluation(job, profile, base);
  const lists = resolveJobSkillListsForDisplay(job);
  return {
    ...enriched,
    matchedSkills: lists.matchedSkills,
    unmatchedSkills: lists.unmatchedSkills,
  };
}

/** Sidebar + match analysis: use API skill columns from refreshAndPersist (same as a fully evaluated job). */
export function resolveJobSkillListsForDisplay(job: JobDetail): {
  matchedSkills: string[];
  unmatchedSkills: string[];
} {
  const matched = job.matchedSkills;
  const unmatched = job.unmatchedSkills;
  if (matched != null || unmatched != null) {
    return {
      matchedSkills: matched ?? [],
      unmatchedSkills: unmatched ?? [],
    };
  }
  const fromReport = resolveJobEvaluation(job);
  return {
    matchedSkills: fromReport.matchedSkills ?? [],
    unmatchedSkills: fromReport.unmatchedSkills ?? [],
  };
}

/** Prefer persisted CV↔JD skill columns over stale lists inside score_breakdown. */
export function overlayPersistedJobSkills(
  view: JobEvaluationView,
  job: JobDetail,
): JobEvaluationView {
  if (job.matchedSkills == null && job.unmatchedSkills == null) return view;
  return {
    ...view,
    matchedSkills: job.matchedSkills ?? view.matchedSkills ?? [],
    unmatchedSkills: job.unmatchedSkills ?? view.unmatchedSkills ?? [],
  };
}

export function resolveJobEvaluation(job: JobDetail): JobEvaluationView {

  const raw = job.scoreBreakdown;

  if (raw && typeof raw === 'object') {

    const parsed = parseEvaluationReport(raw as Record<string, unknown>, { fromDailyDelivery: true });

    if (parsed) return overlayPersistedJobSkills(parsed, job);

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

    return overlayPersistedJobSkills(parsed, merged);

  }

  return overlayPersistedJobSkills(resolveJobEvaluation(merged), merged);

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


