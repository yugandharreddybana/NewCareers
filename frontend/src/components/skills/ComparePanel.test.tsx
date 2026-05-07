import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ComparePanel from './ComparePanel';
import type { CompareData } from '@/types/skills-data';

const MOCK_DATA: CompareData = {
  rationale: 'Job A is a better fit because of X and Y.',
  winnerIndex: 0,
  rows: [
    { label: 'Role', values: ['Front End Engineer', 'Software Developer'] },
    { label: 'Salary', values: ['£80,000', '£75,000'] }
  ]
};

describe('ComparePanel', () => {
  it('renders nothing if data is null', () => {
    const { container } = render(
      <MemoryRouter>
        <ComparePanel data={null} open={true} onClose={() => {}} jobIds={['job1', 'job2']} />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders comparison table and rationale', () => {
    render(
      <MemoryRouter>
        <ComparePanel data={MOCK_DATA} open={true} onClose={() => {}} jobIds={['job1', 'job2']} />
      </MemoryRouter>
    );
    
    expect(screen.getByText('Job Comparison')).toBeInTheDocument();
    expect(screen.getByText('Job A is a better fit because of X and Y.')).toBeInTheDocument();
    expect(screen.getByText('Front End Engineer')).toBeInTheDocument();
    expect(screen.getByText('Software Developer')).toBeInTheDocument();
    expect(screen.getByText('£80,000')).toBeInTheDocument();
  });

  it('highlights the winner', () => {
    render(
      <MemoryRouter>
        <ComparePanel data={MOCK_DATA} open={true} onClose={() => {}} jobIds={['job1', 'job2']} />
      </MemoryRouter>
    );
    // Winner is index 0. The header should have a winner text.
    expect(screen.getByText(/Job 1/i)).toBeInTheDocument();
  });
});
