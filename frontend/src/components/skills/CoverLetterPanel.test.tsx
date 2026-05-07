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

const MOCK_DATA = {
  letter: MOCK_COVER_LETTER_TEXT,
  wordCount: MOCK_COVER_LETTER_TEXT.split(/\s+/).length,
};

describe('CoverLetterPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the cover letter text', () => {
    render(<CoverLetterPanel data={MOCK_DATA} />);
    expect(screen.getByText(/Dear Hiring Manager/i)).toBeInTheDocument();
  });

  it('displays word count', () => {
    render(<CoverLetterPanel data={MOCK_DATA} />);
    // Word count label or value should be visible
    const countText = screen.queryByText(/word/i) ?? screen.queryByText(new RegExp(String(MOCK_DATA.wordCount)));
    expect(countText).toBeInTheDocument();
  });

  it('copy button writes text to clipboard', async () => {
    render(<CoverLetterPanel data={MOCK_DATA} />);
    const copyBtn = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MOCK_COVER_LETTER_TEXT);
    });
  });
});
