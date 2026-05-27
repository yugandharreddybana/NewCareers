import { describe, expect, it } from 'vitest';
import { applyGate } from './evaluationApplyGate';

describe('applyGate', () => {
  it('returns go at 4.2', () => {
    expect(applyGate(4.2).level).toBe('go');
  });
  it('returns caution at 3.5', () => {
    expect(applyGate(3.5).level).toBe('caution');
  });
  it('returns stop at 2.8', () => {
    expect(applyGate(2.8).level).toBe('stop');
  });
});
