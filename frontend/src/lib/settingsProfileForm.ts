import type { OnboardingEducationEntry, OnboardingWorkEntry, UpdateProfilePayload } from '@/context/AuthContext';
import type { Profile } from '@/types';
import type { User } from '@/types';
import {
  buildOnboardingProfilePayload,
  type OnboardingBasicInfo,
  type OnboardingEducationInput,
  type OnboardingWorkInput,
} from '@/lib/buildOnboardingProfilePayload';
import type { PreferencesStepValues, WorkSettings } from '@/components/onboarding/PreferencesStep';
import { AVAILABILITY_OPTIONS, WORK_TYPE_OPTIONS } from '@/components/onboarding/PreferencesStep';
import { normalizeYearMonth } from '@/components/onboarding/MonthYearField';

const LEVEL_TO_YEARS: Record<string, string> = {
  junior: '0-2',
  mid: '3-5',
  senior: '6-10',
  lead: '10+',
};

export type SettingsFormState = {
  name: string;
  email: string;
  goalTitle: string;
  goalLocation: string;
  location: string;
  experienceYears: string;
  workExperience: OnboardingWorkEntry[];
  education: OnboardingEducationEntry[];
  selectedRoles: string[];
  selectedTech: string[];
  workTypes: string[];
  workSettings: WorkSettings;
  salaryMinK: number;
  salaryMaxK: number;
  salaryCurrency: string;
  availability: string;
  sponsorship: boolean;
  activeCvFileName: string | null;
  activeCvId: string | null;
  minMatchPercent: number;
};

export function emptyWorkEntry(): OnboardingWorkEntry {
  return {
    jobTitle: '',
    companyName: '',
    startDate: '',
    endDate: '',
    current: false,
    description: '',
  };
}

export function emptyEducationEntry(): OnboardingEducationEntry {
  return {
    schoolName: '',
    degree: '',
    fieldOfStudy: '',
    graduationYear: '',
  };
}

export function remotePolicyToWorkSettings(policy?: string | null): WorkSettings {
  const p = (policy ?? '').toLowerCase();
  if (p.includes('hybrid')) return { remote: false, onsite: false, hybrid: true };
  if (p.includes('remote')) return { remote: true, onsite: false, hybrid: false };
  if (p.includes('on-site') || p.includes('onsite')) return { remote: false, onsite: true, hybrid: false };
  return { remote: true, onsite: false, hybrid: false };
}

/** Empty form for first paint or when GET /profile fails — still shows the full settings UI. */
export function defaultSettingsForm(user: User | null): SettingsFormState {
  return profileToSettingsForm({}, user);
}

export function profileToSettingsForm(profile: Profile, user: User | null): SettingsFormState {
  const salaryMin = profile.salaryMin ?? profile.goalSalaryMin ?? 60_000;
  const salaryMax = profile.salaryMax ?? profile.goalSalaryMax ?? 120_000;

  const work =
    profile.workExperience && profile.workExperience.length > 0
      ? profile.workExperience.map(w => ({
          jobTitle: w.jobTitle ?? '',
          companyName: w.companyName ?? '',
          startDate: normalizeYearMonth(w.startDate),
          endDate: normalizeYearMonth(w.endDate),
          current: w.current ?? false,
          description: w.description ?? '',
        }))
      : [emptyWorkEntry()];

  const edu =
    profile.education && profile.education.length > 0
      ? profile.education.map(e => ({
          schoolName: e.schoolName ?? '',
          degree: e.degree ?? '',
          fieldOfStudy: e.fieldOfStudy ?? '',
          graduationYear: e.graduationYear ?? '',
        }))
      : [emptyEducationEntry()];

  const availability =
    profile.availability && AVAILABILITY_OPTIONS.includes(profile.availability as (typeof AVAILABILITY_OPTIONS)[number])
      ? profile.availability
      : AVAILABILITY_OPTIONS[1];

  const workTypes =
    profile.sectors && profile.sectors.length > 0
      ? profile.sectors.filter(s => (WORK_TYPE_OPTIONS as readonly string[]).includes(s))
      : ['Full-time'];

  return {
    name: user?.name ?? '',
    email: user?.email ?? '',
    goalTitle: profile.goalTitle ?? '',
    goalLocation: profile.goalLocation ?? '',
    location: profile.location ?? '',
    experienceYears: LEVEL_TO_YEARS[profile.experienceLevel ?? 'mid'] ?? '3-5',
    workExperience: work,
    education: edu,
    selectedRoles: profile.targetRoles ?? [],
    selectedTech: profile.techStack ?? [],
    workTypes: workTypes.length > 0 ? workTypes : ['Full-time'],
    workSettings: remotePolicyToWorkSettings(profile.remotePolicy),
    salaryMinK: Math.round(salaryMin / 1000),
    salaryMaxK: Math.round(salaryMax / 1000),
    salaryCurrency: profile.salaryCurrency ?? 'EUR',
    availability,
    sponsorship: profile.sponsorshipRequired ?? false,
    activeCvFileName: profile.activeCvFileName ?? null,
    activeCvId: profile.activeCvId ?? null,
    minMatchPercent: profile.minMatchPercent ?? 60,
  };
}

export function settingsFormToPayload(form: SettingsFormState): UpdateProfilePayload {
  const basic: OnboardingBasicInfo = {
    fullName: form.name,
    headline: form.goalTitle,
    experienceYears: form.experienceYears,
    location: form.location || form.goalLocation,
  };

  const work: OnboardingWorkInput[] = form.workExperience;
  const edu: OnboardingEducationInput[] = form.education;

  const preferences: PreferencesStepValues = {
    selectedRoles: form.selectedRoles,
    selectedTech: form.selectedTech,
    workTypes: form.workTypes,
    workSettings: form.workSettings,
    salaryMinK: form.salaryMinK,
    salaryMaxK: form.salaryMaxK,
    salaryCurrency: form.salaryCurrency,
    availability: form.availability,
    cvFile: null,
    sponsorship: form.sponsorship,
    minMatchPercent: form.minMatchPercent,
  };

  const { onboarded: _ignored, ...payload } = buildOnboardingProfilePayload(
    basic,
    work,
    edu,
    preferences,
  );

  const trimmedGoalLoc = form.goalLocation.trim();
  if (trimmedGoalLoc) {
    payload.goalLocation = trimmedGoalLoc;
  }

  return payload;
}
