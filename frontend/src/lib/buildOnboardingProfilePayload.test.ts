import { describe, expect, it } from 'vitest';
import { buildOnboardingProfilePayload, deriveRemotePolicy } from './buildOnboardingProfilePayload';
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
  maxAgeDays: 7,
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
      freshnessHours: 168,
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

  it('includes normalized profile links when provided', () => {
    const payload = buildOnboardingProfilePayload(
      {
        fullName: 'Jane Doe',
        headline: '',
        experienceYears: '3-5',
        location: 'Dublin',
        linkedInUrl: 'linkedin.com/in/jane',
        portfolioUrl: 'jane.dev',
        githubUrl: 'github.com/jane',
      },
      [],
      [],
      basePreferences(),
    );

    expect(payload.linkedInUrl).toBe('https://linkedin.com/in/jane');
    expect(payload.websiteUrl).toBe('https://jane.dev');
    expect(payload.githubUrl).toBe('https://github.com/jane');
  });

  it('omits profile links when blank', () => {
    const payload = buildOnboardingProfilePayload(
      {
        fullName: 'Jane Doe',
        headline: '',
        experienceYears: '3-5',
        location: 'Dublin',
        linkedInUrl: '',
        portfolioUrl: '  ',
        githubUrl: '',
      },
      [],
      [],
      basePreferences(),
    );

    expect(payload.linkedInUrl).toBeUndefined();
    expect(payload.websiteUrl).toBeUndefined();
    expect(payload.githubUrl).toBeUndefined();
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

describe('deriveRemotePolicy', () => {
  it('defaults to Hybrid when no work setting is selected', () => {
    expect(
      deriveRemotePolicy({ remote: false, onsite: false, hybrid: false }),
    ).toBe('Hybrid');
  });

  it('encodes multi-select work settings as comma-separated policy', () => {
    expect(
      deriveRemotePolicy({ remote: true, onsite: true, hybrid: true }),
    ).toBe('Remote, On-site, Hybrid');
  });
});
