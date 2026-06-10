import type { OnboardingCvParseResponse } from '@/services/api';
import { parseDegree, stripFieldFromDegreeTitle, type DegreeLevel } from '@/lib/degreeNormalization';
import { normalizeProjectUrl, promoteProjectLink } from '@/lib/extractProjectLink';

export type MappedWorkEntry = {
  jobTitle: string;
  companyName: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
  location: string;
};

export type MappedEducationEntry = {
  schoolName: string;
  degreeLevel: DegreeLevel | '';
  degreeTitle: string;
  fieldOfStudy: string;
  startYear: string;
  endYear: string;
  graduationYear: string;
  location: string;
};

export type MappedProjectEntry = {
  projectName: string;
  projectLink: string;
  location: string;
  techStack: string;
  projectDetails: string;
};

function emptyWork(): MappedWorkEntry {
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

function emptyEducation(): MappedEducationEntry {
  return {
    schoolName: '',
    degreeLevel: '',
    degreeTitle: '',
    fieldOfStudy: '',
    startYear: '',
    endYear: '',
    graduationYear: '',
    location: '',
  };
}

function emptyProject(): MappedProjectEntry {
  return {
    projectName: '',
    projectLink: '',
    location: '',
    techStack: '',
    projectDetails: '',
  };
}

function hasWorkContent(w: MappedWorkEntry): boolean {
  return Boolean(w.jobTitle.trim() || w.companyName.trim());
}

function hasEducationContent(e: MappedEducationEntry): boolean {
  return Boolean(
    e.schoolName.trim()
    || e.degreeTitle.trim()
    || e.degreeLevel
    || e.fieldOfStudy.trim()
    || e.startYear.trim()
    || e.endYear.trim()
    || e.graduationYear.trim()
    || e.location.trim(),
  );
}

function hasProjectContent(p: MappedProjectEntry): boolean {
  return Boolean(
    p.projectName.trim()
    || p.projectLink.trim()
    || p.techStack.trim()
    || p.projectDetails.trim(),
  );
}

const PIPE_TITLE = /^(.+?)\s*\|\s*(.+)$/;

function looksLikeLocationSegment(segment: string): boolean {
  const t = segment.trim();
  if (!t || /^link$|^demo$|^url$/i.test(t)) return false;
  if (/^https?:\/\//i.test(t) || /^www\./i.test(t)) return false;
  const lower = t.toLowerCase();
  if (lower.includes('ireland') || lower.includes('india') || lower.includes('dublin') || lower.includes('remote')) {
    return true;
  }
  return t.includes(',');
}

function salvageWorkPipeFields(
  companyName: string,
  location: string,
): Pick<MappedWorkEntry, 'companyName' | 'location'> {
  let company = companyName.trim();
  let loc = location.trim();

  if (company.includes('|')) {
    const match = PIPE_TITLE.exec(company);
    if (match?.[1] && match[2] && looksLikeLocationSegment(match[2])) {
      company = match[1].trim();
      if (!loc) loc = match[2].trim();
    }
  }
  if (!company && loc.includes('|')) {
    const match = PIPE_TITLE.exec(loc);
    if (match?.[1] && match[2] && looksLikeLocationSegment(match[2])) {
      company = match[1].trim();
      loc = match[2].trim();
    }
  }
  return { companyName: company, location: loc };
}

function salvageProjectFields(
  title: string,
  url: string,
  description: string,
): Pick<MappedProjectEntry, 'projectName' | 'projectLink' | 'projectDetails'> {
  let projectName = title.trim();
  let projectLink = url.trim();
  let projectDetails = description.trim();

  if (!projectName && projectDetails) {
    const newline = projectDetails.indexOf('\n');
    const firstLine = (newline >= 0 ? projectDetails.slice(0, newline) : projectDetails).trim();
    const match = PIPE_TITLE.exec(firstLine);
    if (match?.[1] && match[2]) {
      projectName = match[1].trim();
      const right = match[2].trim();
      if (/^https?:\/\//i.test(right) || /^www\./i.test(right) || /github\.com/i.test(right)) {
        projectLink = projectLink || right;
      }
      projectDetails =
        newline >= 0 ? projectDetails.slice(newline + 1).trim() : '';
    }
  }

  const promoted = promoteProjectLink({
    projectName,
    projectLink,
    projectDetails,
  });

  return {
    projectName,
    projectLink: promoted.projectLink,
    projectDetails: promoted.projectDetails,
  };
}

/**
 * Maps backend CV parse response into onboarding form rows.
 * Ensures at least one editable row per section.
 */
export function mapCvParseToOnboarding(response: OnboardingCvParseResponse): {
  workEntries: MappedWorkEntry[];
  educationEntries: MappedEducationEntry[];
  projectEntries: MappedProjectEntry[];
} {
  const workEntries = (response.workExperience ?? [])
    .map(w => {
      const salvaged = salvageWorkPipeFields(
        w.companyName?.trim() ?? '',
        w.location?.trim() ?? '',
      );
      return {
        jobTitle: w.jobTitle?.trim() ?? '',
        companyName: salvaged.companyName,
        startDate: w.startDate?.trim() ?? '',
        endDate: w.endDate?.trim() ?? '',
        current: Boolean(w.current),
        description: w.description?.trim() ?? '',
        location: salvaged.location,
      };
    })
    .filter(hasWorkContent);

  const educationEntries = (response.education ?? [])
    .map(e => {
      const rawDegree = e.degree?.trim() ?? '';
      const parsed = parseDegree(rawDegree);
      const field = e.fieldOfStudy?.trim() || parsed.fieldHint || '';
      const degreeTitle = field
        ? stripFieldFromDegreeTitle(parsed.title, field)
        : parsed.title;
      const endYear = (e.endYear?.trim() || e.graduationYear?.trim()) ?? '';
      return {
        schoolName: e.schoolName?.trim() ?? '',
        degreeLevel: parsed.level,
        degreeTitle,
        fieldOfStudy: field,
        startYear: e.startYear?.trim() ?? '',
        endYear,
        graduationYear: endYear,
        location: e.location?.trim() ?? '',
      };
    })
    .filter(hasEducationContent);

  const projectEntries = (response.projects ?? [])
    .map(p => {
      const salvaged = salvageProjectFields(
        p.title?.trim() ?? '',
        normalizeProjectUrl(p.url?.trim() ?? ''),
        p.description?.trim() ?? '',
      );
      return {
        ...salvaged,
        location: p.location?.trim() ?? '',
        techStack: (p.techTags ?? []).join(', '),
      };
    })
    .filter(hasProjectContent);

  return {
    workEntries: workEntries.length > 0 ? workEntries : [emptyWork()],
    educationEntries: educationEntries.length > 0 ? educationEntries : [emptyEducation()],
    projectEntries: projectEntries.length > 0 ? projectEntries : [emptyProject()],
  };
}

export { emptyWork, emptyEducation, emptyProject };
