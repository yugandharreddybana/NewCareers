import { describe, expect, it } from 'vitest';
import { buildOnboardingProfilePayload } from './buildOnboardingProfilePayload';
import type { PreferencesStepValues } from '@/components/onboarding/PreferencesStep';

const basePreferences = (): PreferencesStepValues => ({
  selectedRoles: ['Software Engineer'],
  selectedTech: ['React', 'TypeScript'],
  workTypes: ['Full-time'],
  workSettings: { remote: true, onsite: false, hybrid: false },
  salaryMinK: 60,
  salaryMaxK: 120,
  salaryCurrency: 'EUR',
  availability: '2 weeks notice',
  cvFile: null,
  sponsorship: true,
  minMatchPercent: 60,
});

describe('buildOnboardingProfilePayload', () => {
  it('maps every onboarding section to profile API fields', () => {
    const payload = buildOnboardingProfilePayload(
      {
        fullName: 'Jane Doe',
        headline: 'Senior Product Designer',
        experienceYears: '6-10',
        location: 'Dublin, Ireland',
      },
      [
        {
          jobTitle: 'Engineer',
          companyName: 'Acme',
          startDate: '2020-01',
          endDate: '2023-06',
          current: false,
          description: 'Built APIs',
        },
      ],
      [
        {
          schoolName: 'State U',
          degree: 'bachelors',
          fieldOfStudy: 'CS',
          graduationYear: '2020',
        },
      ],
      basePreferences(),
    );

    expect(payload).toMatchObject({
      name: 'Jane Doe',
      goalTitle: 'Senior Product Designer',
      targetRoles: ['Software Engineer'],
      techStack: ['React', 'TypeScript'],
      sectors: ['Full-time'],
      location: 'Dublin, Ireland',
      salaryMin: 60_000,
      salaryMax: 120_000,
      salaryCurrency: 'EUR',
      availability: '2 weeks notice',
      experienceLevel: 'senior',
      sponsorshipRequired: true,
      openToRemote: true,
      remotePolicy: 'Remote',
      onboarded: true,
    });
    expect(payload.workExperience).toHaveLength(1);
    expect(payload.workExperience?.[0]).toMatchObject({
      jobTitle: 'Engineer',
      companyName: 'Acme',
      startDate: '2020-01',
      endDate: '2023-06',
      current: false,
    });
    expect(payload.education).toHaveLength(1);
  });

  it('clears end date on current roles', () => {
    const payload = buildOnboardingProfilePayload(
      { fullName: 'A', headline: '', experienceYears: '3-5', location: 'X' },
      [
        {
          jobTitle: 'Dev',
          companyName: 'Co',
          startDate: '2024-01',
          endDate: '2099-12',
          current: true,
          description: '',
        },
      ],
      [],
      basePreferences(),
    );
    expect(payload.workExperience?.[0]?.endDate).toBe('');
    expect(payload.workExperience?.[0]?.current).toBe(true);
  });
});
