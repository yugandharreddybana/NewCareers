// Section 3.6 Task 71 — Guided product tour for first-time users
// Uses a step-by-step highlight overlay. Steps are keyed to DOM element IDs.
// Tour auto-launches once per user (keyed in memory; persist to user prefs in production).
import React, { useEffect, useState } from 'react';

export interface TourStep {
  targetId: string;  // ID of the element to highlight
  title: string;
  body: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

interface ProductTourProps {
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
}

export const ProductTour: React.FC<ProductTourProps> = ({ steps, onComplete, onSkip }) => {
  const [current, setCurrent] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});

  const step = steps[current];

  useEffect(() => {
    if (!step) return;
    const el = document.getElementById(step.targetId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const rect = el.getBoundingClientRect();
    const placement = step.placement ?? 'bottom';

    setHighlightStyle({
      position: 'fixed',
      top: rect.top - 4,
      left: rect.left - 4,
      width: rect.width + 8,
      height: rect.height + 8,
      borderRadius: 10,
      boxShadow: '0 0 0 4000px rgba(0,0,0,0.55)',
      zIndex: 9998,
      pointerEvents: 'none',
    });

    const offset = 16;
    const style: React.CSSProperties = {
      position: 'fixed',
      zIndex: 9999,
      maxWidth: 320,
      minWidth: 260,
    };
    if (placement === 'bottom') { style.top = rect.bottom + offset; style.left = rect.left; }
    if (placement === 'top')    { style.bottom = window.innerHeight - rect.top + offset; style.left = rect.left; }
    if (placement === 'right')  { style.top = rect.top; style.left = rect.right + offset; }
    if (placement === 'left')   { style.top = rect.top; style.right = window.innerWidth - rect.left + offset; }
    setTooltipStyle(style);
  }, [current, step]);

  if (!step) return null;

  const handleNext = () => {
    if (current < steps.length - 1) setCurrent(c => c + 1);
    else onComplete();
  };

  return (
    <>
      {/* Highlight overlay */}
      <div style={highlightStyle} aria-hidden="true" />

      {/* Tooltip card */}
      <div
        style={tooltipStyle}
        role="dialog"
        aria-label={`Tour step ${current + 1} of ${steps.length}: ${step.title}`}
        className="tour-tooltip"
      >
        <div className="tour-tooltip__header">
          <span className="tour-step-counter">{current + 1} / {steps.length}</span>
          <button className="tour-skip" onClick={onSkip} aria-label="Skip tour">
            Skip tour
          </button>
        </div>
        <h3 className="tour-tooltip__title">{step.title}</h3>
        <p className="tour-tooltip__body">{step.body}</p>
        <div className="tour-tooltip__footer">
          {current > 0 && (
            <button className="btn btn-ghost tour-back" onClick={() => setCurrent(c => c - 1)}>
              Back
            </button>
          )}
          <button className="btn btn-primary tour-next" onClick={handleNext}>
            {current === steps.length - 1 ? 'Get started →' : 'Next →'}
          </button>
        </div>
      </div>
    </>
  );
};

// Pre-defined tour for first-time Dashboard visit
export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    targetId: 'dashboard-search-bar',
    title: 'Search for roles',
    body: 'Start by searching for a job title or company. CareerOps will analyse match strength and surface the best opportunities for your profile.',
    placement: 'bottom',
  },
  {
    targetId: 'dashboard-skill-actions',
    title: 'Your AI skill toolkit',
    body: 'These 14 skills generate tailored CVs, cover letters, interview prep, and more — all personalised to the specific role you select.',
    placement: 'bottom',
  },
  {
    targetId: 'dashboard-planner-card',
    title: 'Application Planner',
    body: 'CareerOps auto-generates your next actions for every job. Never miss a follow-up or deadline.',
    placement: 'top',
  },
  {
    targetId: 'nav-progress',
    title: 'Track your weekly progress',
    body: 'See your application streaks, response rates, and AI-generated wins and bottlenecks every week.',
    placement: 'right',
  },
];
