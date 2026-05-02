// Section 3.6 Task 74 — In-app checklist for first application success milestone
// Displayed as a floating checklist panel until all steps are complete.
// Steps are driven by backend onboarding events; local state fallback used for demo.
import React, { useEffect, useState } from 'react';
import axios from '../../api/axiosInstance';

interface ChecklistStep {
  key: string;
  label: string;
  description: string;
  completed: boolean;
}

const INITIAL_STEPS: ChecklistStep[] = [
  { key: 'profile_complete',    label: 'Complete your profile',         description: 'Add your skills, experience, and job preferences.',     completed: false },
  { key: 'first_job_saved',     label: 'Save your first job',           description: 'Find a role and save it to your CareerOps board.',       completed: false },
  { key: 'first_skill_run',     label: 'Run your first AI skill',       description: 'Generate a tailored CV or cover letter for that role.',   completed: false },
  { key: 'planner_viewed',      label: 'Check your Application Planner', description: 'Review the auto-generated next steps for your job.',    completed: false },
  { key: 'first_application',   label: 'Submit your first application', description: 'Mark a job as applied to unlock progress tracking.',      completed: false },
];

export const FirstApplicationChecklist: React.FC = () => {
  const [steps, setSteps] = useState<ChecklistStep[]>(INITIAL_STEPS);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Load completed onboarding events from backend
    axios.get<{ completedSteps: string[] }>('/onboarding/checklist')
      .then(r => {
        const completed = new Set(r.data.completedSteps);
        setSteps(prev => prev.map(s => ({ ...s, completed: completed.has(s.key) })));
      })
      .catch(() => {}); // non-fatal
  }, []);

  const completedCount = steps.filter(s => s.completed).length;
  const allDone = completedCount === steps.length;

  if (dismissed) return null;

  return (
    <div
      className={`checklist-panel ${collapsed ? 'checklist-panel--collapsed' : ''} ${allDone ? 'checklist-panel--complete' : ''}`}
      role="region"
      aria-label="Getting started checklist"
    >
      {/* Header */}
      <div className="checklist-header">
        <div className="checklist-header__left">
          <span className="checklist-icon" aria-hidden="true">
            {allDone ? '🎉' : '🚀'}
          </span>
          <div>
            <h3 className="checklist-title">
              {allDone ? 'You\'re all set!' : 'Get your first application out'}
            </h3>
            <div className="checklist-progress-bar" aria-label={`${completedCount} of ${steps.length} steps complete`}>
              <div
                className="checklist-progress-bar__fill"
                style={{ width: `${(completedCount / steps.length) * 100}%` }}
              />
            </div>
            <span className="checklist-progress-text">{completedCount} / {steps.length} complete</span>
          </div>
        </div>
        <div className="checklist-header__actions">
          <button
            className="btn-icon"
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Expand checklist' : 'Collapse checklist'}
          >
            {collapsed ? '▲' : '▼'}
          </button>
          {allDone && (
            <button className="btn-icon" onClick={() => setDismissed(true)} aria-label="Dismiss checklist">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Steps */}
      {!collapsed && (
        <ul className="checklist-steps" role="list">
          {steps.map(step => (
            <li key={step.key} className={`checklist-step ${step.completed ? 'checklist-step--done' : ''}`}>
              <span className="checklist-step__tick" aria-hidden="true">
                {step.completed ? '✅' : '⬜'}
              </span>
              <div className="checklist-step__content">
                <span className="checklist-step__label">{step.label}</span>
                {!step.completed && (
                  <span className="checklist-step__desc">{step.description}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
