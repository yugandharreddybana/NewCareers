import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SkillPanel from './SkillPanel';
import { skillsApi } from '../../services/skillsApi';

vi.mock('../../services/skillsApi', () => ({
  skillsApi: {
    downloadSkillPdf: vi.fn(() => Promise.resolve()),
  },
}));

const toastPromise = vi.fn((promise: Promise<unknown>, options?: unknown) => ({ promise, options }));
const toastError = vi.fn();

vi.mock('react-hot-toast', () => ({
  default: {
    promise: (promise: Promise<unknown>, options?: unknown) => toastPromise(promise, options),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

describe('SkillPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a dedicated panel when the rich payload matches the expected shape', () => {
    render(
      <SkillPanel
        skillName="cover-letter"
        label="Cover Letter"
        userJobId="job-abc"
        state="done"
        data={{
          letter: 'Dear Hiring Manager,',
          wordCount: 123,
          toneIndicator: 'Direct',
          personalisationHighlights: ['Mentions company mission'],
        }}
      />
    );

    expect(screen.getByText('Dear Hiring Manager,')).toBeInTheDocument();
    expect(screen.getByText(/123 words/i)).toBeInTheDocument();
  });

  it('starts the PDF download through skillsApi with user feedback', async () => {
    render(
      <SkillPanel
        skillName="evaluate"
        label="Full Evaluation"
        userJobId="job-abc"
        state="done"
        data={{ text: 'Result text' }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /pdf/i }));

    await waitFor(() => {
      expect(skillsApi.downloadSkillPdf).toHaveBeenCalledWith('job-abc', 'evaluate');
    });
    expect(toastPromise).toHaveBeenCalledTimes(1);
  });

  it('falls back to structured output when a rich panel payload is malformed', () => {
    render(
      <SkillPanel
        skillName="cover-letter"
        label="Cover Letter"
        userJobId="job-abc"
        state="done"
        data={{ unexpected: 'shape drift' }}
      />
    );

    expect(screen.getByText(/couldn't render the enhanced cover letter view/i)).toBeInTheDocument();
    expect(screen.getByText('unexpected')).toBeInTheDocument();
    expect(screen.getByText('shape drift')).toBeInTheDocument();
  });
});
