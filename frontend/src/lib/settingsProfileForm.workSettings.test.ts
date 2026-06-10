import { describe, expect, it } from 'vitest';
import { remotePolicyToWorkSettings } from './settingsProfileForm';

describe('remotePolicyToWorkSettings', () => {
  it('restores all three modes from comma-separated policy', () => {
    expect(remotePolicyToWorkSettings('Remote, On-site, Hybrid')).toEqual({
      remote: true,
      onsite: true,
      hybrid: true,
    });
  });

  it('restores legacy single Hybrid policy', () => {
    expect(remotePolicyToWorkSettings('Hybrid')).toEqual({
      remote: false,
      onsite: false,
      hybrid: true,
    });
  });
});
