import { describe, expect, it } from 'vitest';
import v2Fixture from '@/test/fixtures/evaluation-v2.json';
import { applyGate } from '@/lib/evaluationApplyGate';
import {
  evaluationDimensionsForDisplay,
  parseEvaluationReport,
  resolveJobEvaluation,
} from '@/lib/jobEvaluation';
import type { JobDetail } from '@/types';

describe('parseEvaluationReport V2', () => {
  it('parses fixture with dimensions, applyScore, archetype', () => {
    const view = parseEvaluationReport(v2Fixture as Record<string, unknown>);
    expect(view).not.toBeNull();
    expect(view!.schemaVersion).toBe(2);
    expect(view!.applyScore).toBe(4.2);
    expect(view!.archetype).toBe('Product builder');
    expect(view!.dimensions).toHaveLength(10);
    expect(view!.legacy).toBe(false);
    expect(applyGate(view!.applyScore).level).toBe('go');
  });

  it('maps legacy flat keys to dimensions with legacy badge', () => {
    const view = parseEvaluationReport({
      overallScore: 80,
      matchPercent: 80,
      role_fit: 4.5,
      skills_match: 4.0,
      verdict: 'Worth applying',
    });
    expect(view!.legacy).toBe(true);
    expect(view!.dimensions?.length).toBeGreaterThanOrEqual(2);
    expect(evaluationDimensionsForDisplay(view!).length).toBeGreaterThanOrEqual(2);
  });
});

describe('resolveJobEvaluation', () => {
  it('reads scoreBreakdown from job detail', () => {
    const job: JobDetail = {
      userJobId: 'uj-1',
      jobId: 'j-1',
      title: 'Designer',
      company: 'Acme',
      location: 'Dublin',
      kanbanColumn: 'Discovered',
      status: 'new',
      scoreBreakdown: v2Fixture as Record<string, unknown>,
    };
    const view = resolveJobEvaluation(job);
    expect(view.applyScore).toBe(4.2);
    expect(view.fromDailyDelivery).toBe(true);
  });
});
