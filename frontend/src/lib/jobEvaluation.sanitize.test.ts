import { describe, expect, it } from 'vitest';
import { sanitizeHumanSummary } from './jobEvaluation';

describe('sanitizeHumanSummary', () => {
  it('strips encrypted headline prefix', () => {
    const raw =
      'Headline: F+ltIU+rCn9abcdefghijklmnopqrstuvwxyz0123456789+/=. Your background aligns with 3 core signals.';
    expect(sanitizeHumanSummary(raw)).toBe(
      'Your background aligns with 3 core signals.',
    );
  });

  it('preserves clean summaries', () => {
    const raw = 'Your background aligns with 2 core signals for Developer at Co (68%).';
    expect(sanitizeHumanSummary(raw)).toBe(raw);
  });
});
