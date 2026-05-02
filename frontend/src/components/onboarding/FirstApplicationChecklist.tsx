// Section 3.6 Task 74 — In-app checklist for first application success milestone
import React, { useEffect, useState } from 'react';
import axios from '../../api/axiosInstance';
import { useOnboardingTracker } from '../../hooks/useOnboardingTracker';

interface ChecklistStep {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  href?: string;
}

const INITIAL_STEPS: ChecklistStep[] = [
  { key: 'profile_complete',  label: 'Complete your profile',          description: 'Add skills, experience and job preferences.',          href: '/profile' },
  { key: 'first_job_saved',   label: 'Save your first job',            description: 'Find a role and save it to your CareerOps board.',      href: '/' },
  { key: 'first_skill_run',   label: 'Run your first AI skill',        description: 'Generate a tailored CV or cover letter for that role.', href: '/' },
  { key: 'planner_viewed',    label: 'Check your Application Planner', description: 'Review auto-generated next steps for your job.',        href: '/' },
  { key: 'first_application', label: 'Submit your first application',  description: 'Mark a job as applied to unlock progress tracking.',    href: '/' },
].map(s => ({ ...s, completed: false }));

export const FirstApplicationChecklist: React.FC = () => {
  const [steps, setSteps]       = useState<ChecklistStep[]>(INITIAL_STEPS);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { trackStep } = useOnboardingTracker();

  useEffect(() => {
    axios.get<{ completedSteps: string[] }>('/onboarding/checklist')
      .then(r => {
        const done = new Set(r.data.completedSteps);
        setSteps(prev => prev.map(s => ({ ...s, completed: done.has(s.key) })));
      })
      .catch(() => {});
  }, []);

  const completedCount = steps.filter(s => s.completed).length;
  const allDone = completedCount === steps.length;

  if (dismissed) return null;

  return (
    <div
      className={`checklist-panel${collapsed ? ' checklist-panel--collapsed' : ''}${allDone ? ' checklist-panel--complete' : ''}`}
      role="region"
      aria-label="Getting started checklist"
    >
      <div className="checklist-header">
        <div className="checklist-header__left">
          <span className="checklist-icon" aria-hidden="true">{allDone ? '🎉' : '🚀'}</span>
          <div>
            <h3 className="checklist-title">
              {allDone ? "You're all set!" : 'Get your first application out'}
            </h3>
            <div
              className="checklist-progress-bar"
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-label={`${completedCount} of ${steps.length} steps complete`}
            >
              <div className="checklist-progress-bar__fill" style={{ width: `${(completedCount / steps.length) * 100}%` }} />
            </div>
            <span className="checklist-progress-text">{completedCount} / {steps.length} complete</span>
          </div>
        </div>
        <div className="checklist-header__actions">
          <button className="btn-icon" onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? 'Expand checklist' : 'Collapse checklist'}>
            {collapsed ? '▲' : '▼'}
          </button>
          {allDone && (
            <button className="btn-icon" onClick={() => { setDismissed(true); trackStep('first_application','completed'); }} aria-label="Dismiss checklist">✕</button>
          )}
        </div>
      </div>

      {!collapsed && (
        <ul className="checklist-steps" role="list">
          {steps.map(step => (
            <li key={step.key} className={`checklist-step${step.completed ? ' checklist-step--done' : ''}`}>
              <span className="checklist-step__tick" aria-hidden="true">{step.completed ? '✅' : '⬜'}</span>
              <div className="checklist-step__content">
                <span className="checklist-step__label">{step.label}</span>
                {!step.completed && (
                  <>
                    <span className="checklist-step__desc">{step.description}</span>
                    {step.href && (
                      <a href={step.href} className="checklist-step__link">Go →</a>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
