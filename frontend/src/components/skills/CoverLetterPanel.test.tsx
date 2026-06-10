import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CoverLetterPanel } from './CoverLetterPanel';

describe('CoverLetterPanel', () => {
  it('renders paragraphs separately and shows token badge', () => {
    render(
      <CoverLetterPanel
        data={{
          letter: 'Dear Manager,\n\nFirst paragraph here.\n\nYours sincerely,\nAlex',
          wordCount: 8,
          toneIndicator: 'Professional & Direct',
        }}
        tokensUsed={4000}
      />,
    );

    expect(screen.getByText('Dear Manager,')).toBeInTheDocument();
    expect(screen.getByText('First paragraph here.')).toBeInTheDocument();
    expect(screen.getByText(/4k tokens used to generate this/i)).toBeInTheDocument();
    expect(screen.getByText(/8 words/i)).toBeInTheDocument();
  });
});
