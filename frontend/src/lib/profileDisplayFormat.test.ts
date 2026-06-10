import { describe, expect, it } from 'vitest';
import {
  formatEducationYearRange,
  formatWorkDateRange,
  formatYearMonthLabel,
} from './profileDisplayFormat';

describe('formatYearMonthLabel', () => {
  it('formats YYYY-MM', () => {
    expect(formatYearMonthLabel('2020-03')).toBe('Mar 2020');
  });

  it('returns year-only strings as-is', () => {
    expect(formatYearMonthLabel('2020')).toBe('2020');
  });

  it('returns empty for blank', () => {
    expect(formatYearMonthLabel('')).toBe('');
    expect(formatYearMonthLabel(null)).toBe('');
  });
});

describe('formatWorkDateRange', () => {
  it('formats start and end', () => {
    expect(formatWorkDateRange('2019-01', '2021-06', false)).toBe('Jan 2019 – Jun 2021');
  });

  it('shows Present when current', () => {
    expect(formatWorkDateRange('2019-01', '', true)).toBe('Jan 2019 – Present');
  });

  it('returns empty when no dates', () => {
    expect(formatWorkDateRange('', '', false)).toBe('');
  });
});

describe('formatEducationYearRange', () => {
  it('prefers start and end year', () => {
    expect(formatEducationYearRange('2018', '2022', '2022')).toBe('2018 – 2022');
  });

  it('falls back to graduation year as end', () => {
    expect(formatEducationYearRange('', '', '2020')).toBe('2020');
  });

  it('returns start only when end missing', () => {
    expect(formatEducationYearRange('2018', '', '')).toBe('2018');
  });
});
