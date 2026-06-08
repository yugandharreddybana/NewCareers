import { describe, it, expect } from 'vitest';
import { sanitizeJobEvaluationPdfPayload } from './downloadJobEvaluationPdf';

describe('sanitizeJobEvaluationPdfPayload', () => {
  it('strips lone surrogates without throwing', () => {
    const payload = sanitizeJobEvaluationPdfPayload({
      title: 'Role',
      company: 'Co',
      location: 'Dublin',
      humanSummary: `Summary with lone high \uD800 surrogate`,
    });
    expect(payload.humanSummary).toBe('Summary with lone high  surrogate');
    expect(() => JSON.stringify(payload)).not.toThrow();
  });

  it('preserves valid surrogate pairs', () => {
    const emoji = '\uD83D\uDE00';
    const payload = sanitizeJobEvaluationPdfPayload({
      title: 'Role',
      company: 'Co',
      location: 'Dublin',
      humanSummary: `Good ${emoji} fit`,
    });
    expect(payload.humanSummary).toContain(emoji);
  });

  it('returns JSON-serializable plain object', () => {
    const payload = sanitizeJobEvaluationPdfPayload({
      title: 'Role',
      company: 'Co',
      location: 'Dublin',
      matchPercent: 82,
      matchedSkills: ['TypeScript'],
    });
    const roundTrip = JSON.parse(JSON.stringify(payload)) as typeof payload;
    expect(roundTrip.title).toBe('Role');
    expect(roundTrip.matchPercent).toBe(82);
    expect(Object.keys(roundTrip)).not.toContain('undefined');
  });
});
