import { describe, it, expect } from 'vitest';
import { formatSkillTokens, formatSkillTokensCompact } from './formatSkillTokens';

describe('formatSkillTokens', () => {
  it('formats thousands as k', () => {
    expect(formatSkillTokens(4123)).toBe('4k tokens used to generate this');
  });

  it('formats small counts literally', () => {
    expect(formatSkillTokens(850)).toBe('850 tokens used to generate this');
  });

  it('returns null for missing values', () => {
    expect(formatSkillTokens(null)).toBeNull();
    expect(formatSkillTokens(0)).toBeNull();
  });
});

describe('formatSkillTokensCompact', () => {
  it('formats compact k suffix', () => {
    expect(formatSkillTokensCompact(3000)).toBe('3k');
  });
});
