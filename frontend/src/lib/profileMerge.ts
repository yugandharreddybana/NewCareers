import type { UpdateProfilePayload } from '@/context/AuthContext';
import type { Profile } from '@/types';

export function profileOptimisticFromPayload(prev: Profile, payload: UpdateProfilePayload): Profile {
  const next: Profile = { ...prev };
  if (payload.targetRoles !== undefined) next.targetRoles = payload.targetRoles;
  if (payload.techStack !== undefined) next.techStack = payload.techStack;
  if (payload.location !== undefined) next.location = payload.location;
  if (payload.goalLocation !== undefined) next.goalLocation = payload.goalLocation;
  if (payload.salaryMin !== undefined) next.salaryMin = payload.salaryMin;
  if (payload.salaryMax !== undefined) next.salaryMax = payload.salaryMax;
  if (payload.salaryCurrency !== undefined) next.salaryCurrency = payload.salaryCurrency;
  if (payload.availability !== undefined) next.availability = payload.availability;
  if (payload.sectors !== undefined) next.sectors = payload.sectors;
  if (payload.minMatchPercent !== undefined) next.minMatchPercent = payload.minMatchPercent;
  if (payload.freshnessHours !== undefined) next.freshnessHours = payload.freshnessHours;
  if (payload.sponsorshipRequired !== undefined) next.sponsorshipRequired = payload.sponsorshipRequired;
  if (payload.openToRemote !== undefined) next.openToRemote = payload.openToRemote;
  if (payload.remotePolicy !== undefined) next.remotePolicy = payload.remotePolicy;
  if (payload.hybridOnsiteDays !== undefined) next.hybridOnsiteDays = payload.hybridOnsiteDays;
  if (payload.experienceLevel !== undefined) next.experienceLevel = payload.experienceLevel;
  if (payload.workTypes !== undefined) next.workTypes = payload.workTypes;
  if (payload.goalTitle !== undefined) next.goalTitle = payload.goalTitle;
  if (payload.workExperience !== undefined) next.workExperience = payload.workExperience;
  if (payload.education !== undefined) next.education = payload.education;
  if (payload.jobDomain !== undefined) next.jobDomain = payload.jobDomain;
  if (payload.onboarded !== undefined) next.onboarded = payload.onboarded;
  return next;
}

export function payloadAffectsPipelineMatch(payload: UpdateProfilePayload): boolean {
  return (
    payload.targetRoles !== undefined
    || payload.techStack !== undefined
    || payload.minMatchPercent !== undefined
    || payload.experienceLevel !== undefined
    || payload.workExperience !== undefined
    || payload.jobDomain !== undefined
  );
}
