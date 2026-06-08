import { describe, expect, it } from 'vitest';
import v2Fixture from '@/test/fixtures/evaluation-v2.json';
import { applyGate } from '@/lib/evaluationApplyGate';
import {
  evaluationDimensionsForDisplay,
  overlayPersistedJobSkills,
  parseEvaluationReport,
  resolveJobEvaluation,
  resolveJobSkillListsForDisplay,
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
      id: 'uj-1',
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

  it('overlayPersistedJobSkills uses persisted columns when set', () => {
    const job: JobDetail = {
      id: 'uj-1',
      userJobId: 'uj-1',
      jobId: 'j-1',
      title: 'Engineer',
      company: 'Acme',
      location: 'Dublin',
      kanbanColumn: 'Discovered',
      status: 'new',
      matchedSkills: ['React', 'Java', 'TypeScript'],
      unmatchedSkills: ['Kubernetes'],
      scoreBreakdown: {
        matchedSkills: ['Java'],
        unmatchedSkills: ['React', 'TypeScript', 'Node.js'],
        matchPercent: 57,
      },
    };
    const view = resolveJobEvaluation(job);
    expect(view.matchedSkills).toEqual(['React', 'Java', 'TypeScript']);
    expect(view.unmatchedSkills).toEqual(['Kubernetes']);
  });

  it('resolveJobSkillListsForDisplay prefers API columns over scoreBreakdown', () => {
    const job: JobDetail = {
      id: 'uj-1',
      userJobId: 'uj-1',
      jobId: 'j-1',
      title: 'Engineer',
      company: 'Acme',
      location: 'Dublin',
      kanbanColumn: 'Discovered',
      status: 'new',
      matchedSkills: ['Java'],
      unmatchedSkills: ['React', 'Spring Boot', 'TypeScript'],
      scoreBreakdown: {
        matchedSkills: ['Java', 'Spring Boot', 'React', 'TypeScript'],
        unmatchedSkills: [],
        matchPercent: 72,
      },
    };
    const lists = resolveJobSkillListsForDisplay(job);
    expect(lists.matchedSkills).toEqual(['Java']);
    expect(lists.unmatchedSkills).toEqual(['React', 'Spring Boot', 'TypeScript']);
  });

  it('overlayPersistedJobSkills keeps empty persisted gaps over scoreBreakdown', () => {
    const view = parseEvaluationReport({
      matchedSkills: ['Java'],
      unmatchedSkills: ['React', 'Spring', 'Kubernetes'],
    })!;
    const job: JobDetail = {
      id: 'uj-1',
      userJobId: 'uj-1',
      jobId: 'j-1',
      title: 'Engineer',
      company: 'Acme',
      location: 'Dublin',
      kanbanColumn: 'Discovered',
      status: 'new',
      matchedSkills: ['React', 'Java'],
      unmatchedSkills: [],
    };
    const merged = overlayPersistedJobSkills(view, job);
    expect(merged.matchedSkills).toEqual(['React', 'Java']);
    expect(merged.unmatchedSkills).toEqual([]);
  });
});
