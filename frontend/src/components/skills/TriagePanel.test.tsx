import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TriagePanel from './TriagePanel';
import type { TriageData } from '@/types/skills-data';

const MOCK_DATA: TriageData = {
  ranked: [
    { userJobId: 'job1', title: 'Senior React Dev', verdict: 'strong' },
    { userJobId: 'job2', title: 'Junior Dev', verdict: 'weak' }
  ]
};

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('TriagePanel', () => {
  it('renders ranked items', () => {
    render(
      <MemoryRouter>
        <TriagePanel data={MOCK_DATA} open={true} onClose={() => {}} />
      </MemoryRouter>
    );
    
    expect(screen.getByText('Senior React Dev')).toBeInTheDocument();
    expect(screen.getByText('Junior Dev')).toBeInTheDocument();
    expect(screen.getByText('strong')).toBeInTheDocument();
  });

  it('navigates to job when clicked', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <TriagePanel data={MOCK_DATA} open={true} onClose={onClose} />
      </MemoryRouter>
    );
    
    fireEvent.click(screen.getByText('Senior React Dev'));
    expect(mockNavigate).toHaveBeenCalledWith('/jobs/job1');
    expect(onClose).toHaveBeenCalled();
  });
});
