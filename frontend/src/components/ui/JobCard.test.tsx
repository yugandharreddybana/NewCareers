import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { axe } from '@/test/axe';
import JobCard from './JobCard';
import type { JobCard as JobCardType } from '@/types';

const job: JobCardType = {
  userJobId: 'user-job-1',
  jobId: 'job-1',
  title: 'Senior Frontend Engineer',
  company: 'Acme Labs',
  location: 'Dublin',
  kanbanColumn: 'Discovered',
  status: 'NEW',
  matchPercent: 87,
  sourceUrl: 'https://example.com/jobs/1',
  sourceName: 'LinkedIn (Twin AI)',
  matchedSkills: ['React', 'TypeScript'],
};

describe('JobCard', () => {
  it('announces the card context to assistive technology', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <JobCard job={job} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('article', { name: /senior frontend engineer at acme labs, 87% match/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view analysis/i })).toHaveAttribute('href', '/jobs/user-job-1');
  });

  it('has no obvious accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <JobCard job={job} />
      </MemoryRouter>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});