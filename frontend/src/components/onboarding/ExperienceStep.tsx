import toast from 'react-hot-toast';
import { CollapsibleOnboardingSection } from '@/components/onboarding/CollapsibleOnboardingSection';
import { EducationSection } from '@/components/onboarding/EducationSection';
import { ProjectsSection } from '@/components/onboarding/ProjectsSection';
import { WorkExperienceSection } from '@/components/onboarding/WorkExperienceSection';
import {
  emptyEducation,
  emptyProject,
  emptyWork,
  type MappedEducationEntry,
  type MappedProjectEntry,
  type MappedWorkEntry,
} from '@/lib/mapCvParseToOnboarding';
import { isLikelyValidUrl } from '@/lib/normalizeUrl';

export type CvParseSummary = {
  rolesFound: number;
  educationFound: number;
  projectsFound: number;
};

type Props = {
  workEntries: MappedWorkEntry[];
  educationEntries: MappedEducationEntry[];
  projectEntries: MappedProjectEntry[];
  cvParseSummary: CvParseSummary | null;
  parseSource?: 'ai' | 'regex' | null;
  onWorkChange: (index: number, patch: Partial<MappedWorkEntry>) => void;
  onEducationChange: (index: number, patch: Partial<MappedEducationEntry>) => void;
  onProjectChange: (index: number, patch: Partial<MappedProjectEntry>) => void;
  onWorkEntries: (next: MappedWorkEntry[]) => void;
  onEducationEntries: (next: MappedEducationEntry[]) => void;
  onProjectEntries: (next: MappedProjectEntry[]) => void;
  onBack: () => void;
  onContinue: () => void;
};

function countFilledWork(entries: MappedWorkEntry[]) {
  return entries.filter(e => e.jobTitle.trim() || e.companyName.trim()).length;
}

function countFilledEducation(entries: MappedEducationEntry[]) {
  return entries.filter(
    e =>
      e.schoolName.trim()
      || e.degreeTitle.trim()
      || e.degreeLevel
      || e.fieldOfStudy.trim(),
  ).length;
}

function countFilledProjects(entries: MappedProjectEntry[]) {
  return entries.filter(
    e =>
      e.projectName.trim()
      || e.projectLink.trim()
      || e.techStack.trim()
      || e.projectDetails.trim(),
  ).length;
}

export function ExperienceStep({
  workEntries,
  educationEntries,
  projectEntries,
  cvParseSummary: _cvParseSummary,
  parseSource,
  onWorkChange,
  onEducationChange,
  onProjectChange,
  onWorkEntries,
  onEducationEntries,
  onProjectEntries,
  onBack,
  onContinue,
}: Props) {
  const workCount = countFilledWork(workEntries);
  const eduCount = countFilledEducation(educationEntries);
  const projectCount = countFilledProjects(projectEntries);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const badLink = projectEntries.find(
      p => p.projectLink.trim() && !isLikelyValidUrl(p.projectLink),
    );
    if (badLink) {
      toast.error('One project link looks invalid — please check the URL or leave it blank.');
    }
    onContinue();
  }

  const showImportBanner =
    parseSource === 'ai' && (workCount > 0 || eduCount > 0 || projectCount > 0);

  return (
    <>
      <div className="onboarding-card__title onboarding-card__title--experience">
        <h1>Tell us about your background</h1>
        <p>
          Add your work experience, education, and projects so we can match you to the right roles.
        </p>
      </div>

      {showImportBanner && (
        <div className="onboarding-parse-banner" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">
            info
          </span>
          <p>
            We prefilled this from your CV. Please check dates, titles, and descriptions.
          </p>
        </div>
      )}

      <form className="onboarding-form" onSubmit={handleSubmit}>
        <CollapsibleOnboardingSection
          id="work-experience"
          icon="work"
          title="Work Experience"
          countLabel={`${workCount} position${workCount === 1 ? '' : 's'}`}
          defaultExpanded={workCount > 0}
        >
          <WorkExperienceSection
            entries={workEntries}
            onChange={onWorkChange}
            onAdd={() => onWorkEntries([...workEntries, emptyWork()])}
            onRemove={i => onWorkEntries(workEntries.filter((_, idx) => idx !== i))}
          />
        </CollapsibleOnboardingSection>

        <CollapsibleOnboardingSection
          id="education"
          icon="school"
          title="Education"
          countLabel={`${eduCount} school${eduCount === 1 ? '' : 's'}`}
          defaultExpanded={eduCount > 0}
        >
          <EducationSection
            entries={educationEntries}
            onChange={onEducationChange}
            onAdd={() => onEducationEntries([...educationEntries, emptyEducation()])}
            onRemove={i => onEducationEntries(educationEntries.filter((_, idx) => idx !== i))}
          />
        </CollapsibleOnboardingSection>

        <CollapsibleOnboardingSection
          id="projects"
          icon="code"
          title="Projects"
          countLabel={`${projectCount} project${projectCount === 1 ? '' : 's'}`}
          defaultExpanded={projectCount > 0}
        >
          <ProjectsSection
            entries={projectEntries}
            onChange={onProjectChange}
            onAdd={() => onProjectEntries([...projectEntries, emptyProject()])}
            onRemove={i => onProjectEntries(projectEntries.filter((_, idx) => idx !== i))}
          />
        </CollapsibleOnboardingSection>

        <div className="onboarding-actions">
          <button className="onboarding-btn-outline" type="button" onClick={onBack}>
            Back
          </button>
          <button className="onboarding-btn-primary onboarding-btn-primary--full" type="submit">
            Continue
            <span className="material-symbols-outlined" aria-hidden="true">
              arrow_forward
            </span>
          </button>
        </div>
      </form>
    </>
  );
}
