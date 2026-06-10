import { describe, expect, it } from 'vitest';
import { mergeUniqueChipValues } from '@/lib/mergeUniqueChipValues';

describe('mergeUniqueChipValues', () => {
  it('merges without duplicates case-insensitively', () => {
    expect(mergeUniqueChipValues(['React'], ['react', 'TypeScript'])).toEqual([
      'React',
      'TypeScript',
    ]);
  });

  it('skips blank values', () => {
    expect(mergeUniqueChipValues([], ['', '  ', 'Java'])).toEqual(['Java']);
  });
});
