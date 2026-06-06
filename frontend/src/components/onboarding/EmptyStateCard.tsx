// Section 3.6 Task 73 — Empty-state education cards
// Use wherever a list/view could be empty to explain the value and guide next action.
import React from 'react';

interface EmptyStateCardProps {
  icon?: string;          // emoji or icon component string
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  variant?: 'default' | 'subtle' | 'highlight';
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
  icon = '📭',
  title,
  description,
  ctaLabel,
  onCta,
  variant = 'default',
}) => (
  <div className={`empty-state-card empty-state-card--${variant}`} role="status">
    <span className="empty-state-card__icon" aria-hidden="true">{icon}</span>
    <h3 className="empty-state-card__title">{title}</h3>
    <p className="empty-state-card__desc">{description}</p>
    {ctaLabel && onCta && (
      <button className="btn btn-primary empty-state-card__cta" onClick={onCta}>
        {ctaLabel}
      </button>
    )}
  </div>
);

// Pre-defined empty states for each major surface
export const EMPTY_STATES = {
  jobBoard: {
    icon: '🔍',
    title: 'No jobs saved yet',
    description:
      'Search for a role and save it to your board. NewCareers will calculate your match score and generate a full application kit in seconds.',
    ctaLabel: 'Search for jobs',
  },
  planner: {
    icon: '📋',
    title: 'No tasks yet',
    description:
      'Once you save and apply to jobs, NewCareers will auto-generate your next actions — follow-up reminders, prep tasks, and deadline alerts.',
    ctaLabel: 'Save your first job',
  },
  networking: {
    icon: '🤝',
    title: 'No contacts added',
    description:
      'Add recruiters, hiring managers, or alumni you want to reach out to. NewCareers will track interactions and suggest when to follow up.',
    ctaLabel: 'Add a contact',
  },
  progress: {
    icon: '📈',
    title: 'No activity this week',
    description:
      'Start reviewing jobs and submitting applications to unlock your weekly progress report, streak tracking, and AI-generated insights.',
    ctaLabel: 'Browse jobs',
  },
  interviews: {
    icon: '🎯',
    title: 'No interview kits yet',
    description:
      'Generate a company-specific interview kit for any saved role — question bank, talking points, and a mock interview session.',
    ctaLabel: 'Generate interview kit',
  },
  workspace: {
    icon: '👥',
    title: 'No shared workspaces',
    description:
      'Create a workspace to share your job search with a mentor or career coach. They can leave feedback directly on your CV and cover letters.',
    ctaLabel: 'Create a workspace',
  },
};
