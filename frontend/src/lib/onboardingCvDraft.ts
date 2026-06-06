const STORAGE_KEY = 'careerops_onboarding_cv_draft';

export type OnboardingCvDraft = {
  cvMarkdown: string;
  rolesFound: number;
  educationFound: number;
  projectsFound: number;
};

export function writeOnboardingCvDraft(draft: OnboardingCvDraft): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota errors */
  }
}

export function readOnboardingCvDraft(): OnboardingCvDraft | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingCvDraft;
    if (!parsed?.cvMarkdown) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearOnboardingCvDraft(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
