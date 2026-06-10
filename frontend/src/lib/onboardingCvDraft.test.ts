import { afterEach, describe, expect, it } from 'vitest';
import {
  clearOnboardingCvDraft,
  readOnboardingCvDraft,
  writeOnboardingCvDraft,
} from '@/lib/onboardingCvDraft';

describe('onboardingCvDraft', () => {
  afterEach(() => {
    clearOnboardingCvDraft();
  });

  it('persists extractedTechStack, extractedTargetRoles, and parseSource', () => {
    writeOnboardingCvDraft({
      cvMarkdown: '## Summary',
      rolesFound: 2,
      educationFound: 1,
      projectsFound: 0,
      extractedTechStack: ['Java', 'React'],
      extractedTargetRoles: ['Backend Engineer', 'Software Engineer'],
      parseSource: 'ai',
    });

    const draft = readOnboardingCvDraft();
    expect(draft?.extractedTechStack).toEqual(['Java', 'React']);
    expect(draft?.extractedTargetRoles).toEqual(['Backend Engineer', 'Software Engineer']);
    expect(draft?.parseSource).toBe('ai');
  });

  it('truncates oversized cvMarkdown', () => {
    writeOnboardingCvDraft({
      cvMarkdown: 'x'.repeat(40_000),
      rolesFound: 0,
      educationFound: 0,
      projectsFound: 0,
    });

    const draft = readOnboardingCvDraft();
    expect(draft?.cvMarkdown.length).toBeLessThanOrEqual(32_768);
  });
});
