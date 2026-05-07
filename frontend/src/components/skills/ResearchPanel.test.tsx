import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ResearchPanel from './ResearchPanel';
import type { ResearchData } from '@/types/skills-data';

const MOCK_DATA: ResearchData = {
  company: 'Googlix',
  whatTheyDo: 'Making search better.',
  culture: 'Fast paced and innovative.',
  salaryBenchmark: { 'mid': '£60k', 'senior': '£90k' },
  greenFlags: ['Work life balance'],
  redFlags: ['High churn'],
  recentNews: ['Series B funding'],
  interviewStyle: '4 rounds of technical coding.',
  questionsToAsk: ['Plan for expansion?']
};

describe('ResearchPanel', () => {
  it('renders research details', () => {
    render(<ResearchPanel data={MOCK_DATA} open={true} onClose={() => {}} />);
    
    expect(screen.getByText('Research: Googlix')).toBeInTheDocument();
    expect(screen.getByText('Making search better.')).toBeInTheDocument();
    expect(screen.getByText('Fast paced and innovative.')).toBeInTheDocument();
  });

  it('renders salary benchmarks', () => {
    render(<ResearchPanel data={MOCK_DATA} open={true} onClose={() => {}} />);
    
    expect(screen.getByText('mid')).toBeInTheDocument();
    expect(screen.getByText('£60k')).toBeInTheDocument();
    expect(screen.getByText('senior')).toBeInTheDocument();
    expect(screen.getByText('£90k')).toBeInTheDocument();
  });

  it('renders flags and news', () => {
    render(<ResearchPanel data={MOCK_DATA} open={true} onClose={() => {}} />);
    
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByText('Work life balance')).toBeInTheDocument();
    expect(screen.getByText('✗')).toBeInTheDocument();
    expect(screen.getByText('High churn')).toBeInTheDocument();
    expect(screen.getByText('Series B funding')).toBeInTheDocument();
  });

  it('renders interview details and questions', () => {
    render(<ResearchPanel data={MOCK_DATA} open={true} onClose={() => {}} />);
    
    expect(screen.getByText('4 rounds of technical coding.')).toBeInTheDocument();
    expect(screen.getByText('Plan for expansion?')).toBeInTheDocument();
  });
});
