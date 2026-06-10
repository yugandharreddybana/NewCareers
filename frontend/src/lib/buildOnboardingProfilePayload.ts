import type {
  OnboardingEducationEntry,
  OnboardingWorkEntry,
  UpdateProfilePayload,
} from '@/context/AuthContext';
import type { PreferencesStepValues, WorkSettings } from '@/components/onboarding/PreferencesStep';
import { degreeLevelLabel, parseDegree, type DegreeLevel } from '@/lib/degreeNormalization';
import type { MappedEducationEntry, MappedProjectEntry } from '@/lib/mapCvParseToOnboarding';
import { normalizeUrl } from '@/lib/normalizeUrl';

export type OnboardingWorkInput = OnboardingWorkEntry;
export type OnboardingEducationInput = OnboardingEducationEntry | MappedEducationEntry;

export type OnboardingBasicInfo = {
  fullName: string;
  headline: string;
  experienceYears: string;
  location: string;
  linkedInUrl?: string;
  portfolioUrl?: string;
  githubUrl?: string;
  jobDomain?: string;
};

const EXPERIENCE_YEARS_TO_LEVEL: Record<string, string> = {
  '0-2': 'junior',
  '3-5': 'mid',
  '6-10': 'senior',
  '10+': 'lead',
};

/** Encodes multi-select work settings into {@code remote_policy} (max 32 chars in DB). */
export function deriveRemotePolicy(settings: WorkSettings): string {
  const parts: string[] = [];
  if (settings.remote) parts.push('Remote');
  if (settings.onsite) parts.push('On-site');
  if (settings.hybrid) parts.push('Hybrid');
  return parts.length > 0 ? parts.join(', ') : 'Hybrid';
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
      location: (w.location ?? '').trim(),
    }));
}

function mapEducation(entries: OnboardingEducationInput[]): OnboardingEducationEntry[] {
  return entries
    .filter(e => {
      const legacyDegree = 'degree' in e ? (e.degree ?? '').trim() : '';
      return Boolean(
        e.schoolName.trim()
        || (e.degreeTitle ?? '').trim()
        || e.degreeLevel
        || legacyDegree
        || e.fieldOfStudy.trim(),
      );
    })
    .map(e => {
      const legacySource = 'degree' in e ? (e.degree ?? '') : '';
      const parsed = e.degreeLevel
        ? null
        : parseDegree((e.degreeTitle ?? legacySource).trim());
      const degreeLevel = (e.degreeLevel || parsed?.level || '') as DegreeLevel | '';
      const degreeTitle = (e.degreeTitle ?? parsed?.title ?? legacySource).trim();
      const legacyDegree =
        degreeTitle || (degreeLevel ? degreeLevelLabel(degreeLevel as DegreeLevel) : legacySource.trim());
      const endYear = (e.endYear?.trim() || e.graduationYear?.trim()) ?? '';
      const row: OnboardingEducationEntry = {
        schoolName: e.schoolName.trim(),
        degree: legacyDegree,
        fieldOfStudy: e.fieldOfStudy.trim() || parsed?.fieldHint || '',
        startYear: (e.startYear ?? '').trim(),
        endYear,
        graduationYear: endYear,
        location: (e.location ?? '').trim(),
      };
      if (degreeLevel) row.degreeLevel = degreeLevel;
      if (degreeTitle) row.degreeTitle = degreeTitle;
      return row;
    });
}

export function filterProjectEntries(entries: MappedProjectEntry[]): MappedProjectEntry[] {
  return entries.filter(
    p =>
      p.projectName.trim()
      || p.projectLink.trim()
      || p.techStack.trim()
      || p.projectDetails.trim(),
  );
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

  const linkedIn = basic.linkedInUrl?.trim() ?? '';
  const portfolio = basic.portfolioUrl?.trim() ?? '';
  const github = basic.githubUrl?.trim() ?? '';

  return {
    name: trimmedName,
    ...(linkedIn ? { linkedInUrl: normalizeUrl(linkedIn) } : {}),
    ...(portfolio ? { websiteUrl: normalizeUrl(portfolio) } : {}),
    ...(github ? { githubUrl: normalizeUrl(github) } : {}),
    ...(basic.jobDomain?.trim()
      ? { jobDomain: basic.jobDomain.trim().toUpperCase() }
      : {}),
    ...(trimmedHeadline ? { goalTitle: trimmedHeadline } : {}),
    targetRoles,
    techStack: [...preferences.selectedTech],
    sectors: [...preferences.workTypes],
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
