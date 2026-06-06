import type {
  OnboardingEducationEntry,
  OnboardingWorkEntry,
  UpdateProfilePayload,
} from '@/context/AuthContext';
import type { PreferencesStepValues, WorkSettings } from '@/components/onboarding/PreferencesStep';

export type OnboardingBasicInfo = {
  fullName: string;
  headline: string;
  experienceYears: string;
  location: string;
  jobDomain?: string;
};

export type OnboardingWorkInput = {
  jobTitle: string;
  companyName: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
};

export type OnboardingEducationInput = {
  schoolName: string;
  degree: string;
  fieldOfStudy: string;
  graduationYear: string;
};

const EXPERIENCE_YEARS_TO_LEVEL: Record<string, string> = {
  '0-2': 'junior',
  '3-5': 'mid',
  '6-10': 'senior',
  '10+': 'lead',
};

export function deriveRemotePolicy(settings: WorkSettings): string {
  const { remote, onsite, hybrid } = settings;
  if (hybrid || (remote && onsite)) return 'Hybrid';
  if (remote) return 'Remote';
  if (onsite) return 'On-site';
  return 'Hybrid';
}

function mapWorkExperience(entries: OnboardingWorkInput[]): OnboardingWorkEntry[] {
  return entries
    .filter(w => w.jobTitle.trim() || w.companyName.trim())
    .map(w => ({
      jobTitle: w.jobTitle.trim(),
      companyName: w.companyName.trim(),
      startDate: w.startDate,
      endDate: w.current ? '' : w.endDate,
      current: w.current,
      description: w.description.trim(),
    }));
}

function mapEducation(entries: OnboardingEducationInput[]): OnboardingEducationEntry[] {
  return entries
    .filter(e => e.schoolName.trim())
    .map(e => ({
      schoolName: e.schoolName.trim(),
      degree: e.degree.trim(),
      fieldOfStudy: e.fieldOfStudy.trim(),
      graduationYear: e.graduationYear.trim(),
    }));
}

/**
 * Maps all onboarding wizard state to PUT /profile body fields
 * that ProfileService.upsert persists on user_profiles + users.name.
 */
export function buildOnboardingProfilePayload(
  basic: OnboardingBasicInfo,
  workEntries: OnboardingWorkInput[],
  educationEntries: OnboardingEducationInput[],
  preferences: PreferencesStepValues,
): UpdateProfilePayload {
  const trimmedHeadline = basic.headline.trim();
  const trimmedName = basic.fullName.trim();
  const trimmedLocation = basic.location.trim();

  const targetRoles =
    preferences.selectedRoles.length > 0
      ? preferences.selectedRoles
      : trimmedHeadline
        ? [trimmedHeadline]
        : [];

  return {
    name: trimmedName,
    ...(basic.jobDomain?.trim()
      ? { jobDomain: basic.jobDomain.trim().toUpperCase() }
      : {}),
    ...(trimmedHeadline ? { goalTitle: trimmedHeadline } : {}),
    targetRoles,
    techStack: [...preferences.selectedTech],
    workTypes: [...preferences.workTypes],
    location: trimmedLocation || 'Dublin',
    salaryMin: preferences.salaryMinK * 1000,
    salaryMax: preferences.salaryMaxK * 1000,
    salaryCurrency: preferences.salaryCurrency,
    availability: preferences.availability,
    experienceLevel: EXPERIENCE_YEARS_TO_LEVEL[basic.experienceYears] ?? 'mid',
    sponsorshipRequired: preferences.sponsorship,
    minMatchPercent: preferences.minMatchPercent,
    freshnessHours: Math.max(24, (preferences.maxAgeDays ?? 7) * 24),
    openToRemote: preferences.workSettings.remote || preferences.workSettings.hybrid,
    remotePolicy: deriveRemotePolicy(preferences.workSettings),
    workExperience: mapWorkExperience(workEntries),
    education: mapEducation(educationEntries),
    onboarded: true,
  };
}
