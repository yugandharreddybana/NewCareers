/** Canonical onboarding role chips — keep in sync with backend OnboardingRoleCatalog. */
export const SUGGESTED_ROLES = [
  'Senior Product Designer',
  'UX Lead',
  'Product Manager',
  'Frontend Architect',
  'Software Engineer',
  'Full Stack Developer',
  'Backend Engineer',
  'Data Engineer',
] as const;

export type SuggestedRole = (typeof SUGGESTED_ROLES)[number];
