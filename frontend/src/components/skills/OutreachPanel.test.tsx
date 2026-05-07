import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OutreachPanel from './OutreachPanel';
import type { OutreachData } from '@/types/skills-data';
import toast from 'react-hot-toast';

vi.mock('react-hot-toast');

const MOCK_DATA: OutreachData = {
  subject: 'Hello',
  body: 'This is a message.',
  channel: 'email',
  tone: 'professional',
  wordCount: 4,
  alternatives: ['Hi there', 'Greetings']
};

describe('OutreachPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders outreach details', () => {
    render(<OutreachPanel data={MOCK_DATA} open={true} onClose={() => {}} />);
    
    expect(screen.getByText('Draft Outreach')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.getByText('professional')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('updates textarea value', () => {
    render(<OutreachPanel data={MOCK_DATA} open={true} onClose={() => {}} />);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('This is a message.');
    
    fireEvent.change(textarea, { target: { value: 'New message' } });
    expect(textarea.value).toBe('New message');
  });

  it('copies to clipboard', () => {
    render(<OutreachPanel data={MOCK_DATA} open={true} onClose={() => {}} />);
    
    const copyBtn = screen.getByText(/Copy to clipboard/i);
    fireEvent.click(copyBtn);
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('This is a message.');
    expect(toast.success).toHaveBeenCalledWith('Copied to clipboard');
  });

  it('uses alternative message', () => {
    render(<OutreachPanel data={MOCK_DATA} open={true} onClose={() => {}} />);
    
    const useButtons = screen.getAllByText('Use this');
    expect(useButtons).toHaveLength(2);
    fireEvent.click(useButtons[0]!);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Hi there');
  });
});
