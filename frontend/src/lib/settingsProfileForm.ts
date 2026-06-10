import type { OnboardingEducationEntry, OnboardingWorkEntry, UpdateProfilePayload } from '@/context/AuthContext';
import type { PortfolioItem, Profile } from '@/types';
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
import { readableDisplayName } from '@/lib/readableDisplayName';

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
  portfolioItems: PortfolioItem[];
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
  freshnessHours: number;
  jobDomain?: string;
};

export function emptyWorkEntry(): OnboardingWorkEntry {
  return {
    jobTitle: '',
    companyName: '',
    startDate: '',
    endDate: '',
    current: false,
    description: '',
    location: '',
  };
}

export function emptyEducationEntry(): OnboardingEducationEntry {
  return {
    schoolName: '',
    degree: '',
    fieldOfStudy: '',
    startYear: '',
    endYear: '',
    graduationYear: '',
    location: '',
  };
}

export function remotePolicyToWorkSettings(policy?: string | null): WorkSettings {
  const raw = (policy ?? '').trim();
  if (!raw) return { remote: true, onsite: false, hybrid: false };
  const lower = raw.toLowerCase();
  const remote = /\bremote\b/.test(lower);
  const onsite = /\bon-?site\b/.test(lower);
  const hybrid = /\bhybrid\b/.test(lower);
  if (remote || onsite || hybrid) {
    return { remote, onsite, hybrid };
  }
  return { remote: true, onsite: false, hybrid: false };
}

/** Empty form for first paint or when GET /profile fails — still shows the full settings UI. */
export function defaultSettingsForm(user: User | null): SettingsFormState {
  return profileToSettingsForm({}, user);
}

export function profileToSettingsForm(profile: Profile, user: User | null): SettingsFormState {
  const salaryMin = profile.salaryMin ?? 60_000;
  const salaryMax = profile.salaryMax ?? 120_000;

  const work =
    profile.workExperience && profile.workExperience.length > 0
      ? profile.workExperience.map(w => ({
          jobTitle: w.jobTitle ?? '',
          companyName: w.companyName ?? '',
          startDate: normalizeYearMonth(w.startDate),
          endDate: normalizeYearMonth(w.endDate),
          current: w.current ?? false,
          description: w.description ?? '',
          location: w.location ?? '',
        }))
      : [emptyWorkEntry()];

  const edu =
    profile.education && profile.education.length > 0
      ? profile.education.map(e => {
          const endYear = (e.endYear?.trim() || e.graduationYear?.trim()) ?? '';
          const row: OnboardingEducationEntry = {
            schoolName: e.schoolName ?? '',
            degree: e.degree ?? '',
            fieldOfStudy: e.fieldOfStudy ?? '',
            startYear: e.startYear ?? '',
            endYear,
            graduationYear: endYear,
            location: e.location ?? '',
          };
          if (e.degreeLevel) row.degreeLevel = e.degreeLevel;
          if (e.degreeTitle) row.degreeTitle = e.degreeTitle;
          else if (e.degree) row.degreeTitle = e.degree;
          return row;
        })
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
    name: readableDisplayName(user?.name) || user?.name?.trim() || '',
    email: user?.email ?? '',
    goalTitle: readableDisplayName(profile.goalTitle),
    goalLocation: readableDisplayName(profile.goalLocation),
    location: readableDisplayName(profile.location),
    experienceYears: LEVEL_TO_YEARS[profile.experienceLevel ?? 'mid'] ?? '3-5',
    workExperience: work,
    education: edu,
    portfolioItems: profile.portfolioItems ?? [],
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
    freshnessHours: profile.freshnessHours ?? 168,
    ...(profile.jobDomain ? { jobDomain: profile.jobDomain } : {}),
  };
}

export function settingsFormToPayload(form: SettingsFormState): UpdateProfilePayload {
  const basic: OnboardingBasicInfo = {
    fullName: form.name,
    headline: form.goalTitle,
    experienceYears: form.experienceYears,
    location: form.location || form.goalLocation,
    ...(form.jobDomain ? { jobDomain: form.jobDomain } : {}),
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
    maxAgeDays: Math.round(form.freshnessHours / 24) || 7,
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
