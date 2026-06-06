import type { OnboardingCvParseResponse } from '@/services/api';

export type MappedWorkEntry = {
  jobTitle: string;
  companyName: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
};

export type MappedEducationEntry = {
  schoolName: string;
  degree: string;
  fieldOfStudy: string;
  graduationYear: string;
};

function emptyWork(): MappedWorkEntry {
  return {
    jobTitle: '',
    companyName: '',
    startDate: '',
    endDate: '',
    current: false,
    description: '',
  };
}

function emptyEducation(): MappedEducationEntry {
  return {
    schoolName: '',
    degree: '',
    fieldOfStudy: '',
    graduationYear: '',
  };
}

function hasWorkContent(w: MappedWorkEntry): boolean {
  return Boolean(w.jobTitle.trim() || w.companyName.trim());
}

function hasEducationContent(e: MappedEducationEntry): boolean {
  return Boolean(e.schoolName.trim() || e.degree.trim());
}

/**
 * Maps backend CV parse response into onboarding form rows.
 * Ensures at least one editable row per section.
 */
export function mapCvParseToOnboarding(response: OnboardingCvParseResponse): {
  workEntries: MappedWorkEntry[];
  educationEntries: MappedEducationEntry[];
} {
  const workEntries = (response.workExperience ?? [])
    .map(w => ({
      jobTitle: w.jobTitle?.trim() ?? '',
      companyName: w.companyName?.trim() ?? '',
      startDate: w.startDate?.trim() ?? '',
      endDate: w.endDate?.trim() ?? '',
      current: Boolean(w.current),
      description: w.description?.trim() ?? '',
    }))
    .filter(hasWorkContent);

  const educationEntries = (response.education ?? [])
    .map(e => ({
      schoolName: e.schoolName?.trim() ?? '',
      degree: e.degree?.trim() ?? '',
      fieldOfStudy: e.fieldOfStudy?.trim() ?? '',
      graduationYear: e.graduationYear?.trim() ?? '',
    }))
    .filter(hasEducationContent);

  return {
    workEntries: workEntries.length > 0 ? workEntries : [emptyWork()],
    educationEntries: educationEntries.length > 0 ? educationEntries : [emptyEducation()],
  };
}
