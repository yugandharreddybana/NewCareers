import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useSkill } from '@/hooks/useSkill';
import { useJobsList } from '@/hooks/queries';
import type { JobCard } from '@/types';
import { SKILL_CATALOG, SKILL_COUNT, getSkillCatalogItem, type SkillCatalogItem } from '@/lib/skillCatalog';
import type { JobDetail } from '@/types';
import type { SkillName, SkillState } from '@/types/skills';
import { JobEvaluationModal } from '@/components/job-detail/JobEvaluationModal';
import { SkillHelpTooltip } from '@/components/job-detail/SkillHelpTooltip';
import {
  evaluationFromSkillPayload,
  hasStoredJobEvaluation,
  resolveJobEvaluation,
  type JobEvaluationView,
} from '@/lib/jobEvaluation';
import {
  RunAllSkillsButton,
  SkillPanel,
  SkillQuestionModal,
} from '@/components/skills';

type Props = {
  job: JobDetail;
  /** Increment from parent to open the evaluation modal (e.g. sidebar CTA). */
  openEvaluationSignal?: number;
  onJobRefresh?: () => void | Promise<void>;
};

function mapHookStateToButtonState(
  skillId: SkillName,
  activeSkill: SkillName | null,
  hookState: SkillState,
  completed: Set<SkillName>,
): SkillState {
  if (activeSkill === skillId) {
    if (hookState === 'waiting_answer') return 'loading';
    if (hookState === 'profile_incomplete') return 'error';
    return hookState;
  }
  if (completed.has(skillId)) return 'done';
  return 'idle';
}

function buildCompareJobIds(currentUserJobId: string, pipelineJobs: JobCard[]): string[] {
  const ids = pipelineJobs.map(j => j.userJobId).filter(Boolean);
  const unique = [...new Set([currentUserJobId, ...ids])];
  return unique.slice(0, 5);
}

export function JobDetailSkillsTab({
  job,
  openEvaluationSignal = 0,
  onJobRefresh,
}: Props) {
  const userJobId = job.userJobId;
  const { data: jobsList } = useJobsList();

  const [activeSkill, setActiveSkill] = useState<SkillName | null>(null);
  const [completedSkills, setCompletedSkills] = useState<Set<SkillName>>(() => {
    const initial = new Set<SkillName>();
    if (hasStoredJobEvaluation(job)) initial.add('evaluate');
    return initial;
  });
  const [panelOpen, setPanelOpen] = useState(true);
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const [evaluationView, setEvaluationView] = useState<JobEvaluationView>(() =>
    resolveJobEvaluation(job),
  );
  const [deepEvalRunning, setDeepEvalRunning] = useState(false);

  const {
    state,
    data,
    question,
    skillName,
    missingFields,
    error,
    needsAnswer,
    isLoading,
    startSkill,
    handleAnswer,
    loadLastRun,
    prepareSkill,
    reset,
  } = useSkill();

  const openJobEvaluation = useCallback(() => {
    setEvaluationView(resolveJobEvaluation(job));
    setEvaluationOpen(true);
    setCompletedSkills(prev => new Set(prev).add('evaluate'));
  }, [job]);

  useEffect(() => {
    setEvaluationView(resolveJobEvaluation(job));
  }, [job]);

  useEffect(() => {
    if (openEvaluationSignal > 0) {
      openJobEvaluation();
    }
  }, [openEvaluationSignal, openJobEvaluation]);

  useEffect(() => {
    if (state === 'done' && skillName) {
      setCompletedSkills(prev => {
        const next = new Set(prev);
        next.add(skillName);
        return next;
      });
      if (skillName === 'evaluate' && data) {
        const parsed = evaluationFromSkillPayload(data, job);
        if (parsed) {
          setEvaluationView(parsed);
          setEvaluationOpen(true);
          toast.success('Evaluation updated from your CV');
        }
        void onJobRefresh?.();
      }
    }
  }, [state, skillName, data, job, onJobRefresh]);

  const handleDeepEvaluation = useCallback(async () => {
    setDeepEvalRunning(true);
    setEvaluationOpen(true);
    reset();
    try {
      await startSkill({ skillName: 'evaluate', userJobId });
    } finally {
      setDeepEvalRunning(false);
    }
  }, [reset, startSkill, userJobId]);

  const activeEntry = useMemo(
    () => (activeSkill ? getSkillCatalogItem(activeSkill) : undefined),
    [activeSkill],
  );

  const questionSkillLabel =
    activeEntry?.label ??
    (skillName ? skillName.replace(/-/g, ' ') : 'Career Coach');

  const runSkill = useCallback(
    async (entry: SkillCatalogItem) => {
      if (entry.id === 'compare') {
        const compareJobIds = buildCompareJobIds(userJobId, jobsList?.items ?? []);
        if (compareJobIds.length < 2) {
          toast.error('Save at least two jobs to your pipeline to run Compare.');
          return;
        }
        await startSkill({ skillName: 'compare', compareJobIds });
        return;
      }

      if (entry.id === 'triage') {
        await startSkill({ skillName: 'triage' });
        return;
      }

      if (entry.id === 'scan') {
        await startSkill({
          skillName: 'scan',
          userJobId,
          scanTarget: `${job.title} at ${job.company}`,
        });
        return;
      }

      await startSkill({ skillName: entry.id, userJobId });
    },
    [job.company, job.title, startSkill, userJobId],
  );

  const handleSelectSkill = useCallback(
    async (entry: SkillCatalogItem) => {
      if (entry.id === 'evaluate') {
        openJobEvaluation();
        return;
      }

      const sameSkill = activeSkill === entry.id;

      if (sameSkill && state === 'done' && data) {
        setPanelOpen(open => !open);
        return;
      }

      if (sameSkill && (isLoading || needsAnswer)) {
        return;
      }

      setActiveSkill(entry.id);
      setPanelOpen(true);
      reset();
      prepareSkill(entry.id);

      const restored = await loadLastRun(userJobId, entry.id);
      if (restored) return;

      await runSkill(entry);
    },
    [
      activeSkill,
      data,
      isLoading,
      loadLastRun,
      prepareSkill,
      needsAnswer,
      openJobEvaluation,
      reset,
      runSkill,
      state,
      userJobId,
    ],
  );

  const handlePanelRerun = useCallback(() => {
    if (!activeEntry) return;
    void runSkill(activeEntry);
  }, [activeEntry, runSkill]);

  const jobScopedCount = SKILL_CATALOG.filter(s => s.scope === 'job').length;

  return (
    <div className="job-detail-skills flex flex-col gap-6">
      <div className="bg-surface-container-lowest p-margin-mobile md:p-margin-desktop rounded-xl border border-outline-variant shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="material-symbols-outlined text-primary text-[22px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">AI Career Coach</h2>
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                {SKILL_COUNT} skills
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
              Every skill runs in context of{' '}
              <strong className="text-on-surface">
                {job.title}
              </strong>{' '}
              at {job.company}. Results save to this job and can be exported as PDF.
            </p>
          </div>
          <div className="shrink-0">
            <RunAllSkillsButton
                userJobId={userJobId}
                onComplete={() => {
                  setCompletedSkills(new Set(SKILL_CATALOG.map(s => s.id)));
                  toast.success('Background run finished. Open each skill to review results.');
                }}
              />
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {SKILL_CATALOG.map(entry => {
          const buttonState =
            entry.id === 'evaluate' && hasStoredJobEvaluation(job)
              ? ('done' as SkillState)
              : mapHookStateToButtonState(entry.id, activeSkill, state, completedSkills);
          const isActive = activeSkill === entry.id;

          return (
            <div
              key={entry.id}
              role="button"
              tabIndex={0}
              onClick={() => void handleSelectSkill(entry)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void handleSelectSkill(entry);
                }
              }}
              className={[
                'job-detail-skill-card text-left rounded-xl border p-4 transition-all cursor-pointer',
                'hover:border-primary/40 hover:shadow-md active:scale-[0.99]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                isActive
                  ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                  : 'border-outline-variant bg-surface-container-lowest',
                buttonState === 'done' && !isActive ? 'border-emerald-200/80' : '',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                <span
                  className={[
                    'material-symbols-outlined text-[22px] shrink-0',
                    isActive || buttonState === 'loading' ? 'text-primary' : 'text-secondary',
                  ].join(' ')}
                >
                  {entry.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="font-label-md text-label-md text-on-surface truncate">
                        {entry.label}
                      </span>
                      <SkillHelpTooltip
                        tip={entry.tooltip}
                        label={`What ${entry.label} does`}
                      />
                    </span>
                    {buttonState === 'loading' && (
                      <span className="material-symbols-outlined text-primary text-[18px] animate-spin">
                        progress_activity
                      </span>
                    )}
                    {buttonState === 'done' && (
                      <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                        check_circle
                      </span>
                    )}
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 line-clamp-2">
                    {entry.description}
                  </p>
                  {entry.scope !== 'job' && (
                    <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wide text-secondary bg-surface-container-high px-2 py-0.5 rounded">
                      {entry.scope === 'pipeline' ? 'Pipeline' : 'Profile'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="font-body-sm text-body-sm text-secondary -mt-2">
        {jobScopedCount} skills are scoped to this role · Compare and Triage use your wider pipeline
      </p>

      {activeEntry && panelOpen && (
        <div className="job-detail-skill-panel">
          <SkillPanel
            skillName={activeEntry.id}
            label={activeEntry.label}
            userJobId={userJobId}
            state={
              activeSkill === (skillName ?? activeSkill) ? state : 'idle'
            }
            data={activeSkill === (skillName ?? activeSkill) ? data : null}
            error={activeSkill === (skillName ?? activeSkill) ? error : null}
            missingFields={
              activeSkill === (skillName ?? activeSkill) ? missingFields : []
            }
            isActive
            open
            onRun={handlePanelRerun}
            onDismissAlert={reset}
            onClose={() => setPanelOpen(false)}
          />
        </div>
      )}

      {activeSkill && !panelOpen && state === 'done' && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="text-primary font-label-md text-label-md hover:underline self-start"
        >
          Show {activeEntry?.label ?? 'skill'} results
        </button>
      )}

      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Need the full skills library? Open Skills Coach for batch runs across all saved roles.
        </p>
        <Link
          to="/skills"
          className="inline-flex items-center gap-1 text-primary font-label-md text-label-md hover:underline shrink-0"
        >
          Skills Coach
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </Link>
      </div>

      <SkillQuestionModal
        open={needsAnswer}
        skillName={skillName ?? ''}
        skillLabel={questionSkillLabel}
        question={question ?? ''}
        onAnswer={handleAnswer}
        onSkip={reset}
        isLoading={isLoading}
      />

      <JobEvaluationModal
        open={evaluationOpen}
        onClose={() => setEvaluationOpen(false)}
        job={job}
        evaluation={evaluationView}
        onRunDeepEvaluation={handleDeepEvaluation}
        runningDeepEvaluation={deepEvalRunning || (skillName === 'evaluate' && isLoading)}
      />
    </div>
  );
}

export default JobDetailSkillsTab;
