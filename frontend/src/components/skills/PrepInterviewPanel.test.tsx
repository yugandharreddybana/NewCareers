import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PrepInterviewPanel from './PrepInterviewPanel';
import type { PrepInterviewData } from '@/types/skills-data';

const MOCK_DATA: PrepInterviewData = {
  likelyQuestions: [
    { question: 'Tell me about yourself', category: 'behavioural', starterAnswer: 'I am a dev...' }
  ],
  talkingPoints: ['Highlight React experience'],
  studyPlan: [
    { topic: 'System Design', why: 'Required for this role', resource: 'Blog post' }
  ],
  questionsToAskInterviewer: ['What is the team size?'],
  redFlagsToAddress: ['Gap in employment']
};

describe('PrepInterviewPanel', () => {
  it('renders interview prep sections', () => {
    render(<PrepInterviewPanel data={MOCK_DATA} open={true} onClose={() => {}} />);
    
    expect(screen.getByText('Likely Questions')).toBeInTheDocument();
    expect(screen.getByText('Tell me about yourself')).toBeInTheDocument();
    expect(screen.getByText('Talking Points')).toBeInTheDocument();
    expect(screen.getByText('Highlight React experience')).toBeInTheDocument();
    expect(screen.getByText('Study Plan')).toBeInTheDocument();
    expect(screen.getByText('System Design')).toBeInTheDocument();
    expect(screen.getByText('Questions to Ask the Interviewer')).toBeInTheDocument();
    expect(screen.getByText('Red Flags to Address')).toBeInTheDocument();
  });

  it('expands question to show starter answer', () => {
    render(<PrepInterviewPanel data={MOCK_DATA} open={true} onClose={() => {}} />);
    
    expect(screen.queryByText('Starter answer')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Tell me about yourself'));
    expect(screen.getByText('Starter answer')).toBeInTheDocument();
    expect(screen.getByText('I am a dev...')).toBeInTheDocument();
  });
});
