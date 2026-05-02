// Section 3.6 Task 72 — Contextual help tips
// Lightweight tooltip triggered on hover/focus for any UI element.
// Use: <ContextualHelpTip tip="What this does..." placement="right" />
import React, { useState } from 'react';

interface ContextualHelpTipProps {
  tip: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  label?: string; // accessible label for the trigger icon
}

export const ContextualHelpTip: React.FC<ContextualHelpTipProps> = ({
  tip,
  placement = 'top',
  label = 'More information',
}) => {
  const [visible, setVisible] = useState(false);

  const placementClass = `help-tip--${placement}`;

  return (
    <span
      className="help-tip-wrapper"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <button
        type="button"
        className="help-tip-trigger"
        aria-label={label}
        aria-describedby={visible ? 'help-tip-content' : undefined}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <text x="8" y="12" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="600">?</text>
        </svg>
      </button>
      {visible && (
        <span
          id="help-tip-content"
          role="tooltip"
          className={`help-tip-bubble ${placementClass}`}
        >
          {tip}
        </span>
      )}
    </span>
  );
};

// Pre-defined tips for common surfaces — import and use directly
export const HELP_TIPS = {
  matchScore:
    'Match score is calculated by comparing your profile skills, experience, and preferences against the job requirements. 80%+ is a strong match.',
  skillRun:
    'Running a skill generates a tailored asset for this specific role — your CV, cover letter, or interview prep will reference the actual job description.',
  atsScore:
    'ATS score estimates how well your CV will pass automated screening. Aim for 70%+ to reach a human reviewer.',
  coverLetterTone:
    'CareerOps adapts tone based on the company type and role seniority. You can regenerate with a different tone at any time.',
  plannerTask:
    'These tasks are auto-generated based on your application status. Mark them complete as you go to keep your tracker accurate.',
  streakCount:
    'Your streak counts consecutive days you log in and take at least one action — reviewing a job, submitting an application, or running a skill.',
};
