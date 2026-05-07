import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EvaluationPanel from './EvaluationPanel';
import type { EvaluationData } from '@/types/skills-data';

const MOCK_DATA: EvaluationData = {
  matchPercent: 85,
  overallScore: 90,
  verdict: 'Strong Hire',
  humanSummary: 'Great candidate for this role.',
  matchedSkills: ['React', 'TypeScript'],
  unmatchedSkills: ['GraphQL'],
  cvImprovementTips: ['Add more keywords'],
  sections: {
    executiveSummary: 'Brief intro...',
    backgroundMatch: 'Matches perfectly.'
  }
};

describe('EvaluationPanel', () => {
  it('renders evaluation details', () => {
    render(<EvaluationPanel data={MOCK_DATA} open={true} onClose={() => {}} />);
    
    expect(screen.getByText('Full Evaluation')).toBeInTheDocument();
    expect(screen.getByText('85% match')).toBeInTheDocument();
    expect(screen.getByText('Strong Hire')).toBeInTheDocument();
    expect(screen.getByText('Great candidate for this role.')).toBeInTheDocument();
  });

  it('renders skill chips', () => {
    render(<EvaluationPanel data={MOCK_DATA} open={true} onClose={() => {}} />);
    
    expect(screen.getByText('✓ React')).toBeInTheDocument();
    expect(screen.getByText('✓ TypeScript')).toBeInTheDocument();
    expect(screen.getByText('✗ GraphQL')).toBeInTheDocument();
  });

  it('renders sections', () => {
    render(<EvaluationPanel data={MOCK_DATA} open={true} onClose={() => {}} />);
    
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    expect(screen.getByText('Brief intro...')).toBeInTheDocument();
    expect(screen.getByText('Background Match')).toBeInTheDocument();
    expect(screen.getByText('Matches perfectly.')).toBeInTheDocument();
  });

  it('renders CV tips', () => {
    render(<EvaluationPanel data={MOCK_DATA} open={true} onClose={() => {}} />);
    
    expect(screen.getByText('CV Improvement Tips')).toBeInTheDocument();
    expect(screen.getByText('Add more keywords')).toBeInTheDocument();
  });
});
