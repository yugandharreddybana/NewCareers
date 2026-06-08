import { describe, it, expect, beforeEach, vi } from 'vitest';
import { timeAgo, readLocalStorage, writeLocalStorage } from './utils';

describe('timeAgo', () => {
  it('returns relative hours for same-day posts, not "0 days ago"', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const label = timeAgo(twoHoursAgo);
    expect(label).not.toContain('0 days');
    expect(label).toMatch(/\d+h ago/);
  });

  it('returns "Just now" for very recent posts', () => {
    const justNow = new Date(Date.now() - 30 * 1000).toISOString();
    expect(timeAgo(justNow)).toBe('Just now');
  });

  it('returns "Recently" for empty input', () => {
    expect(timeAgo('')).toBe('Recently');
  });
});

describe('readLocalStorage / writeLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads and writes values', () => {
    writeLocalStorage('test-key', 'hello');
    expect(readLocalStorage('test-key')).toBe('hello');
  });

  it('returns null when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(readLocalStorage('any')).toBeNull();
    vi.restoreAllMocks();
  });

  it('ignores setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(() => writeLocalStorage('any', '1')).not.toThrow();
    vi.restoreAllMocks();
  });
});
