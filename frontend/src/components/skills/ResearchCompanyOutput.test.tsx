import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ResearchCompanyOutput } from './ResearchCompanyOutput';

describe('ResearchCompanyOutput', () => {
  it('renders nested culture object as readable text', () => {
    render(
      <ResearchCompanyOutput
        data={{
          company: 'J P Morgan',
          summary: 'Global financial services firm.',
          culture: {
            overview: 'Professional and dynamic work environment.',
            workStyle: 'Hybrid',
            positiveThemes: ['Collaborative team', 'Growth opportunities'],
            negativeThemes: ['High pressure', 'Demanding workload'],
          },
        }}
      />,
    );

    expect(screen.getByText('Professional and dynamic work environment.')).toBeInTheDocument();
    expect(screen.getByText(/Hybrid/)).toBeInTheDocument();
    expect(screen.getByText('Collaborative team')).toBeInTheDocument();
    expect(screen.getByText('High pressure')).toBeInTheDocument();
    expect(screen.queryByText(/"overview"/)).not.toBeInTheDocument();
  });

  it('renders structured recent news items', () => {
    render(
      <ResearchCompanyOutput
        data={{
          recentNews: [
            { headline: 'Expansion in Dublin', summary: 'New tech hub announced.', dateHint: '2026' },
          ],
        }}
      />,
    );

    expect(screen.getByText('Expansion in Dublin')).toBeInTheDocument();
    expect(screen.getByText('New tech hub announced.')).toBeInTheDocument();
  });
});
