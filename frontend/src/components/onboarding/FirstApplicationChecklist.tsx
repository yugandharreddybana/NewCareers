// Section 3.6 Task 74 — In-app checklist for first application success milestone
import React, { useEffect, useState } from 'react';
import axios from '../../api/axiosInstance';
import { useOnboardingTracker } from '../../hooks/useOnboardingTracker';
import { CheckCircle2, Circle, X, ArrowRight } from 'lucide-react';

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
      className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm animate-enter"
      role="region"
      aria-label="Getting started checklist"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center shrink-0 text-xl">
            {allDone ? '🎉' : '🚀'}
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              {allDone ? "You're all set!" : 'Onboarding Checklist: Get your first application out'}
              <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {completedCount} / {steps.length} steps completed
              </span>
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Follow these simple steps to supercharge your career search with AI.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-xs border border-slate-200 transition-all select-none"
          >
            {collapsed ? 'Expand Checklist' : 'Collapse Checklist'}
          </button>
          {allDone && (
            <button
              onClick={() => { setDismissed(true); trackStep('first_application','completed'); }}
              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all"
              aria-label="Dismiss checklist"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="mt-6 pt-5 border-t border-slate-100 space-y-4">
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / steps.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-bold text-emerald-600 shrink-0">
              {Math.round((completedCount / steps.length) * 100)}%
            </span>
          </div>

          {/* Steps grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {steps.map(step => (
              <div
                key={step.key}
                className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
                  step.completed
                    ? 'bg-emerald-50/30 border-emerald-100/60'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {step.completed ? (
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  ) : (
                    <Circle size={18} className="text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-semibold truncate ${
                      step.completed ? 'text-slate-500 line-through' : 'text-slate-800'
                    }`}>
                      {step.label}
                    </span>
                    {step.href && !step.completed && (
                      <a
                        href={step.href}
                        className="flex items-center gap-1 text-xs font-bold bg-brand-50 hover:bg-brand-100 text-brand-600 px-2.5 py-1 rounded-lg transition-all shrink-0"
                      >
                        Go <ArrowRight size={12} />
                      </a>
                    )}
                  </div>
                  <p className={`text-xs mt-1 leading-relaxed ${
                    step.completed ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
