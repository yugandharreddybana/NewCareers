import { describe, expect, it } from 'vitest';
import { mapCvParseToOnboarding } from '@/lib/mapCvParseToOnboarding';
import type { OnboardingCvParseResponse } from '@/services/api';

describe('mapCvParseToOnboarding', () => {
  it('maps multiple roles with current flag', () => {
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
        },
        {
          jobTitle: 'Intern',
          companyName: 'Beta',
          startDate: '2022-01',
          endDate: '2023-06',
          current: false,
          description: '',
        },
      ],
      education: [
        {
          schoolName: 'Trinity',
          degree: 'BSc CS',
          fieldOfStudy: 'Computer Science',
          graduationYear: '2020',
        },
      ],
      rolesFound: 2,
      educationFound: 1,
    };

    const mapped = mapCvParseToOnboarding(response);
    expect(mapped.workEntries).toHaveLength(2);
    expect(mapped.workEntries[0]?.current).toBe(true);
    expect(mapped.workEntries[1]?.endDate).toBe('2023-06');
    expect(mapped.educationEntries[0]?.schoolName).toBe('Trinity');
  });

  it('returns empty rows when parse finds nothing', () => {
    const mapped = mapCvParseToOnboarding({
      cvMarkdown: '',
      workExperience: [],
      education: [],
      rolesFound: 0,
      educationFound: 0,
    });
    expect(mapped.workEntries).toHaveLength(1);
    expect(mapped.educationEntries).toHaveLength(1);
  });
});
