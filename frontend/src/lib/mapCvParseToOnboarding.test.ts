import { describe, expect, it } from 'vitest';
import { mapCvParseToOnboarding } from '@/lib/mapCvParseToOnboarding';
import type { OnboardingCvParseResponse } from '@/services/api';

describe('mapCvParseToOnboarding', () => {
  it('maps multiple roles with current flag and location', () => {
    const response: OnboardingCvParseResponse = {
      cvMarkdown: '# CV',
      workExperience: [
        {
          jobTitle: 'Engineer',
          companyName: 'Acme',
          startDate: '2024-09',
          endDate: '',
          current: true,
          description: 'Built APIs',
          location: 'Dublin',
        },
        {
          jobTitle: 'Intern',
          companyName: 'Beta',
          startDate: '2022-01',
          endDate: '2023-06',
          current: false,
          description: '',
          location: '',
        },
      ],
      education: [
        {
          schoolName: 'Trinity',
          degree: 'BSc CS',
          fieldOfStudy: 'Computer Science',
          graduationYear: '2020',
          location: 'Dublin',
        },
      ],
      projects: [
        {
          title: 'CareerOps',
          description: 'Job platform',
          url: 'https://github.com/example/careerops',
          location: 'Remote',
        },
      ],
      rolesFound: 2,
      educationFound: 1,
      projectsFound: 1,
    };

    const mapped = mapCvParseToOnboarding(response);
    expect(mapped.workEntries).toHaveLength(2);
    expect(mapped.workEntries[0]?.current).toBe(true);
    expect(mapped.workEntries[0]?.location).toBe('Dublin');
    expect(mapped.educationEntries[0]?.schoolName).toBe('Trinity');
    expect(mapped.educationEntries[0]?.degreeLevel).toBe('bachelors');
    expect(mapped.educationEntries[0]?.degreeTitle).toBe('BSc CS');
    expect(mapped.projectEntries[0]?.projectName).toBe('CareerOps');
    expect(mapped.projectEntries[0]?.projectLink).toBe('https://github.com/example/careerops');
  });

  it('strips field from degree title when fieldOfStudy is separate', () => {
    const mapped = mapCvParseToOnboarding({
      cvMarkdown: '',
      workExperience: [],
      education: [
        {
          schoolName: 'NUIG',
          degree: 'M.Sc Computer Science',
          fieldOfStudy: 'Computer Science',
          graduationYear: '2021',
        },
      ],
      projects: [],
      rolesFound: 0,
      educationFound: 1,
      projectsFound: 0,
    });
    expect(mapped.educationEntries[0]?.degreeTitle).toBe('M.Sc');
    expect(mapped.educationEntries[0]?.fieldOfStudy).toBe('Computer Science');
  });

  it('promotes github link from description when url missing', () => {
    const mapped = mapCvParseToOnboarding({
      cvMarkdown: '',
      workExperience: [],
      education: [],
      projects: [
        {
          title: 'CareerOps Platform',
          description: 'Built APIs.\ngithub.com/user/careerops',
        },
      ],
      rolesFound: 0,
      educationFound: 0,
      projectsFound: 1,
    });
    expect(mapped.projectEntries[0]?.projectLink).toBe('https://github.com/user/careerops');
    expect(mapped.projectEntries[0]?.projectDetails).not.toContain('github.com');
  });

  it('maps techTags and salvages pipe title from description', () => {
    const mapped = mapCvParseToOnboarding({
      cvMarkdown: '',
      workExperience: [],
      education: [],
      projects: [
        {
          title: '',
          description: 'AI-Powered Task Management Application | Link\nBuilt APIs.',
          techTags: ['React', 'Node.js'],
        },
      ],
      rolesFound: 0,
      educationFound: 0,
      projectsFound: 1,
    });
    expect(mapped.projectEntries[0]?.projectName).toBe(
      'AI-Powered Task Management Application',
    );
    expect(mapped.projectEntries[0]?.techStack).toBe('React, Node.js');
    expect(mapped.projectEntries[0]?.projectDetails).toContain('Built APIs');
  });

  it('splits company and location from pipe in work entries', () => {
    const mapped = mapCvParseToOnboarding({
      cvMarkdown: '',
      workExperience: [
        {
          jobTitle: 'Developer',
          companyName: 'Independent Developer | Dublin, Ireland',
          startDate: '2024-09',
          endDate: '',
          current: true,
          description: '',
          location: '',
        },
      ],
      education: [],
      projects: [],
      rolesFound: 1,
      educationFound: 0,
      projectsFound: 0,
    });
    expect(mapped.workEntries[0]?.companyName).toBe('Independent Developer');
    expect(mapped.workEntries[0]?.location).toBe('Dublin, Ireland');
  });

  it('does not map extractedTechStack (handled in Onboarding step 3)', () => {
    const mapped = mapCvParseToOnboarding({
      cvMarkdown: '',
      workExperience: [],
      education: [],
      projects: [],
      rolesFound: 0,
      educationFound: 0,
      projectsFound: 0,
      extractedTechStack: ['Java', 'React'],
      parseSource: 'ai',
    });
    expect(mapped).not.toHaveProperty('selectedTech');
    expect(mapped.workEntries).toHaveLength(1);
  });

  it('returns empty rows when parse finds nothing', () => {
    const mapped = mapCvParseToOnboarding({
      cvMarkdown: '',
      workExperience: [],
      education: [],
      projects: [],
      rolesFound: 0,
      educationFound: 0,
      projectsFound: 0,
    });
    expect(mapped.workEntries).toHaveLength(1);
    expect(mapped.educationEntries).toHaveLength(1);
    expect(mapped.projectEntries).toHaveLength(1);
  });
});
