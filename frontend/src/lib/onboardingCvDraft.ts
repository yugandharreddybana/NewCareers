const STORAGE_KEY = 'careerops_onboarding_cv_draft';
const MAX_MARKDOWN_CHARS = 32_768;

export type OnboardingCvDraft = {
  cvMarkdown: string;
  rolesFound: number;
  educationFound: number;
  projectsFound: number;
  extractedTechStack?: string[];
  extractedTargetRoles?: string[];
  parseSource?: 'ai' | 'regex';
};

export function writeOnboardingCvDraft(draft: OnboardingCvDraft): void {
  try {
    let cvMarkdown = draft.cvMarkdown;
    if (cvMarkdown.length > MAX_MARKDOWN_CHARS) {
      cvMarkdown = cvMarkdown.slice(0, MAX_MARKDOWN_CHARS);
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, cvMarkdown }));
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
