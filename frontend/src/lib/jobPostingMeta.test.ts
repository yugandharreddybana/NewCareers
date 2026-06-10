import { describe, expect, it } from 'vitest';
import type { JobDetail } from '@/types';
import {
  extractJobPostingMeta,
  formatSalaryDisplay,
  stripPostingMetaFromDescription,
} from './jobPostingMeta';

function job(overrides: Partial<JobDetail> = {}): JobDetail {
  return {
    userJobId: 'uj-1',
    jobId: 'j-1',
    title: 'Senior Engineer',
    company: 'Acme',
    location: 'Dublin',
    description:
      'Great role. Salary: €60,000 to €85,000 DOE Hybrid: 3 days in office Requirements: Java',
    kanbanColumn: 'New',
    ...overrides,
  } as JobDetail;
}

describe('jobPostingMeta', () => {
  it('extracts salary and hybrid from description when DB fields empty', () => {
    const meta = extractJobPostingMeta(job());
    expect(meta.salaryLabel).toContain('€60,000');
    expect(meta.workArrangement).toMatch(/Hybrid/i);
  });

  it('formatSalaryDisplay falls back to parsed salary', () => {
    const label = formatSalaryDisplay(job({ salaryMin: undefined, salaryMax: undefined }));
    expect(label).toContain('€60,000');
    expect(label).not.toBe('Competitive');
  });

  it('formatSalaryDisplay prefers structured salary fields', () => {
    const label = formatSalaryDisplay(job({ salaryMin: 70000, salaryMax: 90000, currency: 'EUR' }));
    expect(label).toBe('€70k – €90k');
  });

  it('parses bare EUR range without Salary label', () => {
    const label = formatSalaryDisplay(
      job({
        description: 'Hybrid role in Dublin. €55,000 to €70,000 DOE plus benefits.',
      }),
    );
    expect(label).toContain('55,000');
    expect(label).not.toBe('Competitive');
  });

  it('returns empty string when salary is only competitive placeholder', () => {
    const label = formatSalaryDisplay(
      job({ description: 'Salary: Competitive\n\nGreat team and benefits.' }),
    );
    expect(label).toBe('');
  });

  it('ignores benefits package false positive', () => {
    const label = formatSalaryDisplay(
      job({
        description:
          'Attractive package: bonus, health/dental, pension, etc Senior Java Developer My client is a scaling FinTech org.',
      }),
    );
    expect(label).toBe('');
  });

  it('does not let work arrangement swallow the full description', () => {
    const longPosting =
      'Full Stack Developer (Python / React / AWS) Salary: €60,000 to €85,000 DOE + bonus + benefits + ' +
      'Hybrid: 3 days in the office - Dublin City Centre About the role: We are looking for a talented engineer ' +
      'with strong Python and React experience to build scalable AWS services and modern frontend applications.';
    const meta = extractJobPostingMeta(
      job({
        title: 'Full Stack Developer (Python / React / AWS)',
        description: longPosting,
      }),
    );
    expect(meta.salaryLabel).toContain('€60,000');
    expect(meta.workArrangement).toMatch(/Hybrid/i);
    expect(meta.workArrangement!.length).toBeLessThan(80);
    expect(meta.workArrangement).not.toContain('Python and React');
  });

  it('stripPostingMetaFromDescription removes meta shown in the header row', () => {
    const raw =
      'Full Stack Developer (Python / React / AWS)\n' +
      'Salary: €60,000 to €85,000 DOE\n' +
      'Hybrid: 3 days in the office\n' +
      'About the role:\nWe need a full stack engineer with Python and React.';
    const stripped = stripPostingMetaFromDescription(raw, {
      jobTitle: 'Full Stack Developer (Python / React / AWS)',
      salaryLabel: '€60,000 to €85,000 DOE',
      locationLabel: 'Dublin, Ireland',
      workArrangement: 'Hybrid: 3 days in the office',
    });
    expect(stripped).not.toMatch(/Salary:/i);
    expect(stripped).not.toMatch(/^Hybrid:/im);
    expect(stripped).not.toContain('Full Stack Developer (Python / React / AWS)');
    expect(stripped).toContain('About the role');
    expect(stripped).toContain('Python and React');
  });
});
