import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ApplyAssistantPanel from './ApplyAssistantPanel';
import type { ApplyAssistantData } from '@/types/skills-data';
import { kanbanApi } from '@/services/api';
import toast from 'react-hot-toast';

vi.mock('@/services/api', () => ({
  kanbanApi: {
    patch: vi.fn().mockResolvedValue({})
  }
}));

vi.mock('react-hot-toast');

const MOCK_DATA: ApplyAssistantData = {
  coverLetter: 'This is my cover letter.',
  questionAnswers: [
    { question: 'Why us?', answer: 'Because you are great.' }
  ],
  preSubmitChecklist: ['Check spelling', 'Attach PDF']
};

describe('ApplyAssistantPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders cover letter step by default', () => {
    render(<ApplyAssistantPanel data={MOCK_DATA} open={true} onClose={() => {}} userJobId="job123" />);
    
    expect(screen.getByText('Cover Letter')).toBeInTheDocument();
    expect(screen.getByText('This is my cover letter.')).toBeInTheDocument();
  });

  it('navigates through steps', () => {
    render(<ApplyAssistantPanel data={MOCK_DATA} open={true} onClose={() => {}} userJobId="job123" />);
    
    // Move to step 2
    fireEvent.click(screen.getByText('Next →'));
    expect(screen.getByText('Application Questions')).toBeInTheDocument();
    expect(screen.getByText('Why us?')).toBeInTheDocument();

    // Move to step 3
    fireEvent.click(screen.getByText('Next →'));
    expect(screen.getByText('Pre-submit Checklist')).toBeInTheDocument();
    expect(screen.getByText('Check spelling')).toBeInTheDocument();
  });

  it('marks as applied', async () => {
    const onApplied = vi.fn();
    const onClose = vi.fn();
    render(<ApplyAssistantPanel data={MOCK_DATA} open={true} onClose={onClose} userJobId="job123" onApplied={onApplied} />);
    
    // Go to step 3
    fireEvent.click(screen.getByText('3. Pre-submit Checklist'));
    
    const markBtn = screen.getByText(/Mark as Applied/i);
    fireEvent.click(markBtn);

    await waitFor(() => {
      expect(kanbanApi.patch).toHaveBeenCalledWith('job123', { kanbanColumn: 'Applied', status: 'applied' });
      expect(toast.success).toHaveBeenCalledWith('Moved to Applied in Kanban');
      expect(onApplied).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('copies cover letter to clipboard', async () => {
    render(<ApplyAssistantPanel data={MOCK_DATA} open={true} onClose={() => {}} userJobId="job123" />);
    
    const copyBtn = screen.getByText(/Copy cover letter/i);
    fireEvent.click(copyBtn);
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('This is my cover letter.');
    expect(toast.success).toHaveBeenCalledWith('Copied');
  });
});
