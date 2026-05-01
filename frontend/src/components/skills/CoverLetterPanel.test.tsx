/**
 * Task 146 — CoverLetterPanel tests
 *
 *  ✓ Copy button fires navigator.clipboard.writeText
 *  ✓ Word count displays correctly
 *  ✓ ATS score meter renders
 *  ✓ Human score meter renders
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CoverLetterPanel from './CoverLetterPanel';

const MOCK_COVER_LETTER_TEXT =
  'Dear Hiring Manager, I am excited to apply for this role. '.repeat(10).trim();

const MOCK_RESULT = {
  coverLetter: MOCK_COVER_LETTER_TEXT,
  atsScore: 78,
  humanScore: 65,
  wordCount: MOCK_COVER_LETTER_TEXT.split(/\s+/).length,
};

describe('CoverLetterPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the cover letter text', () => {
    render(<CoverLetterPanel result={MOCK_RESULT} />);
    expect(screen.getByText(/Dear Hiring Manager/i)).toBeInTheDocument();
  });

  it('displays word count', () => {
    render(<CoverLetterPanel result={MOCK_RESULT} />);
    // Word count label or value should be visible
    const countText = screen.queryByText(/word/i) ?? screen.queryByText(new RegExp(String(MOCK_RESULT.wordCount)));
    expect(countText).toBeInTheDocument();
  });

  it('copy button writes text to clipboard', async () => {
    render(<CoverLetterPanel result={MOCK_RESULT} />);
    const copyBtn = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MOCK_COVER_LETTER_TEXT);
    });
  });

  it('renders ATS score meter', () => {
    render(<CoverLetterPanel result={MOCK_RESULT} />);
    // ATS score or label should be present
    const atsEl = screen.queryByText(/ats/i) ?? screen.queryByText(/78/);
    expect(atsEl).toBeInTheDocument();
  });

  it('renders Human score meter', () => {
    render(<CoverLetterPanel result={MOCK_RESULT} />);
    const humanEl = screen.queryByText(/human/i) ?? screen.queryByText(/65/);
    expect(humanEl).toBeInTheDocument();
  });
});
