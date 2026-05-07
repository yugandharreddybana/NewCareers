/**
 * Task 147 — SkillQuestionModal tests
 *
 *  ✓ Opens when pending_answer (open=true)
 *  ✓ Submit button disabled when input is empty
 *  ✓ Fires onAnswer with correct value on submit
 *  ✓ Escape key closes the modal (calls onClose)
 */
import type { HTMLAttributes, ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { axe } from '@/test/axe';
import SkillQuestionModal from './SkillQuestionModal';

type MotionDivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...p }: MotionDivProps) => <div {...p}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

describe('SkillQuestionModal', () => {
  const defaultProps = {
    open: true,
    skillLabel: 'Full Evaluation',
    question: 'What is your main goal in this role?',
    onAnswer: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders the question text when open', () => {
    render(<SkillQuestionModal {...defaultProps} />);
    expect(screen.getByText(/What is your main goal/i)).toBeInTheDocument();
  });

  it('has no obvious accessibility violations when open', async () => {
    const { container } = render(<SkillQuestionModal {...defaultProps} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('does not render when open=false', () => {
    render(<SkillQuestionModal {...defaultProps} open={false} />);
    expect(screen.queryByText(/What is your main goal/i)).not.toBeInTheDocument();
  });

  it('submit button is disabled when input is empty', () => {
    render(<SkillQuestionModal {...defaultProps} />);
    const submitBtn = screen.getByRole('button', { name: /submit|send|answer/i });
    expect(submitBtn).toBeDisabled();
  });

  it('fires onAnswer with the typed value on submit', async () => {
    const onAnswer = vi.fn();
    render(<SkillQuestionModal {...defaultProps} onAnswer={onAnswer} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'I want to grow as a tech lead');

    const submitBtn = screen.getByRole('button', { name: /submit|send|answer/i });
    fireEvent.click(submitBtn);

    expect(onAnswer).toHaveBeenCalledWith('I want to grow as a tech lead');
  });

  it('Escape key calls onClose', async () => {
    const onClose = vi.fn();
    render(<SkillQuestionModal {...defaultProps} onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
