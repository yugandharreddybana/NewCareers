import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useSkill } from '@/hooks/useSkill';
import { useJobsList } from '@/hooks/queries';
import { profileApi } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';
import type { JobCard } from '@/types';
import {
  SKILL_COUNT,
  getSkillCatalogItem,
  jobDetailSkills,
  type SkillCatalogItem,
} from '@/lib/skillCatalog';
import { pipelineStageForSkills } from '@/lib/skillVisibility';
import { ApplyAssistModal } from '@/components/skills/ApplyAssistModal';
import { OutreachDraftModal } from '@/components/skills/OutreachDraftModal';
import { SkillResultModal } from '@/components/ui/SkillResultModal';
import type { JobDetail } from '@/types';
import type { SkillName, SkillState } from '@/types/skills';
import { JobEvaluationModal } from '@/components/job-detail/JobEvaluationModal';
import { CompareJobsModal } from '@/components/kanban/CompareJobsModal';
import { SkillHelpTooltip } from '@/components/job-detail/SkillHelpTooltip';
import {
  buildJobEvaluationView,
  evaluationFromSkillPayload,
  hasStoredJobEvaluation,
  type JobEvaluationView,
} from '@/lib/jobEvaluation';
import {
  RunAllSkillsButton,
  SkillPanel,
  SkillQuestionModal,
} from '@/components/skills';
import { SkillLoadingState } from '@/components/skills/SkillLoadingState';
import type { SkillRunHistoryEntry } from '@/components/skills/SkillRunHistoryBar';
import { skillsApi } from '@/services/skillsApi';

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

function stageLabel(column: JobCard['kanbanColumn']): string {
  if (column === 'Rejected') return 'Archived';
  if (column === 'Saved') return 'Discovered';
  if (column === 'Interview') return 'Interviewing';
  return column;
}

export function JobDetailSkillsTab({
  job,
  openEvaluationSignal = 0,
  onJobRefresh,
}: Props) {
  const userJobId = job.userJobId;
  const { data: jobsList } = useJobsList();
  const { data: profile } = useQuery({
    queryKey: queryKeys.profile.current(),
    queryFn: () => profileApi.get(),
  });

  const [activeSkill, setActiveSkill] = useState<SkillName | null>(null);
  const [completedSkills, setCompletedSkills] = useState<Set<SkillName>>(() => {
    const initial = new Set<SkillName>();
    if (hasStoredJobEvaluation(job)) initial.add('evaluate');
    return initial;
  });
  const [panelOpen, setPanelOpen] = useState(true);
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const [evaluationView, setEvaluationView] = useState<JobEvaluationView>(() =>
    buildJobEvaluationView(job, profile),
  );
  const [deepEvalRunning, setDeepEvalRunning] = useState(false);
  const [applyAssistOpen, setApplyAssistOpen] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [comparePickerOpen, setComparePickerOpen] = useState(false);
  const [runHistory, setRunHistory] = useState<SkillRunHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);

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

  const visibleSkills = useMemo(
    () => jobDetailSkills(pipelineStageForSkills(job.kanbanColumn)),
    [job.kanbanColumn],
  );

  const openJobEvaluation = useCallback(() => {
    setEvaluationOpen(true);
    setCompletedSkills(prev => new Set(prev).add('evaluate'));
    void onJobRefresh?.();
  }, [onJobRefresh]);

  useEffect(() => {
    setEvaluationView(buildJobEvaluationView(job, profile));
  }, [job, profile]);

  useEffect(() => {
    if (evaluationOpen) {
      setEvaluationView(buildJobEvaluationView(job, profile));
    }
  }, [evaluationOpen, job, profile]);

  useEffect(() => {
    if (openEvaluationSignal > 0) {
      openJobEvaluation();
    }
  }, [openEvaluationSignal, openJobEvaluation]);

  /** Restore green checkmarks from saved skill runs (survives logout / page reload). */
  useEffect(() => {
    if (!userJobId) return;
    let cancelled = false;
    void (async () => {
      try {
        const saved = await skillsApi.getCompletedSkills(userJobId);
        if (cancelled || saved.length === 0) return;
        setCompletedSkills(prev => {
          const next = new Set(prev);
          for (const name of saved) {
            next.add(name as SkillName);
          }
          return next;
        });
      } catch {
        // Non-fatal — ticks appear again after the user opens a skill.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userJobId]);

  const refreshRunHistory = useCallback(
    async (skill: SkillName) => {
      if (!userJobId || skill === 'compare' || skill === 'triage' || skill === 'scan') {
        setRunHistory([]);
        return;
      }
      try {
        const runs = await skillsApi.getRunHistory(userJobId, skill);
        setRunHistory(runs);
        setHistoryIndex(0);
      } catch {
        setRunHistory([]);
      }
    },
    [userJobId],
  );

  useEffect(() => {
    if (panelOpen && activeSkill) {
      void refreshRunHistory(activeSkill);
    }
  }, [panelOpen, activeSkill, state, refreshRunHistory]);

  useEffect(() => {
    if (state === 'done' && skillName) {
      if (skillName !== 'evaluate') {
        setSkillModalOpen(true);
      }
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
        void refreshRunHistory(skillName);
      }
    }
  }, [state, skillName, data, job, onJobRefresh, refreshRunHistory]);

  const handleDeepEvaluation = useCallback(async () => {
    setDeepEvalRunning(true);
    setEvaluationOpen(true);
    reset();
    await startSkill({ skillName: 'evaluate', userJobId, forceRefresh: true });
  }, [reset, startSkill, userJobId]);

  useEffect(() => {
    if (skillName === 'evaluate' && (state === 'done' || state === 'error')) {
      setDeepEvalRunning(false);
    }
  }, [state, skillName]);

  const activeEntry = useMemo(
    () => (activeSkill ? getSkillCatalogItem(activeSkill) : undefined),
    [activeSkill],
  );

  const questionSkillLabel =
    activeEntry?.label ??
    (skillName ? skillName.replace(/-/g, ' ') : 'Career Coach');

  const runSkill = useCallback(
    async (entry: SkillCatalogItem, options?: { forceRefresh?: boolean }) => {
      const forceRefresh = options?.forceRefresh ?? false;

      if (entry.id === 'compare') {
        const pipeline = jobsList?.items ?? [];
        if (pipeline.filter(j => j.userJobId && j.kanbanColumn !== 'Rejected').length < 2) {
          toast.error('Save at least two jobs to your pipeline to run Compare.');
          return;
        }
        setComparePickerOpen(true);
        return;
      }

      if (entry.id === 'triage') {
        await startSkill({ skillName: 'triage', forceRefresh });
        return;
      }

      if (entry.id === 'scan') {
        await startSkill({
          skillName: 'scan',
          userJobId,
          scanTarget: `${job.title} at ${job.company}`,
          forceRefresh,
        });
        return;
      }

      if (forceRefresh) {
        setHistoryIndex(0);
        setRunHistory([]);
      }

      await startSkill({ skillName: entry.id, userJobId, forceRefresh });
    },
    [job.company, job.title, jobsList?.items, startSkill, userJobId],
  );

  const handleCompareConfirm = useCallback(
    async (compareJobIds: string[]) => {
      setComparePickerOpen(false);
      setActiveSkill('compare');
      setPanelOpen(true);
      setSkillModalOpen(true);
      reset();
      prepareSkill('compare');
      setHistoryIndex(0);
      setRunHistory([]);
      await startSkill({ skillName: 'compare', compareJobIds, forceRefresh: true });
    },
    [prepareSkill, reset, startSkill],
  );

  const handleSelectSkill = useCallback(
    async (entry: SkillCatalogItem) => {
      if (entry.id === 'evaluate') {
        openJobEvaluation();
        return;
      }

      if (entry.id === 'apply') {
        setApplyAssistOpen(true);
        return;
      }

      if (entry.id === 'outreach') {
        setOutreachOpen(true);
        setCompletedSkills(prev => new Set(prev).add('outreach'));
        return;
      }

      if (entry.id === 'compare') {
        const pipeline = jobsList?.items ?? [];
        if (pipeline.filter(j => j.userJobId && j.kanbanColumn !== 'Rejected').length < 2) {
          toast.error('Save at least two jobs to your pipeline to run Compare.');
          return;
        }
        setComparePickerOpen(true);
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
      setSkillModalOpen(true);
      reset();
      prepareSkill(entry.id);

      const wasCompleted = completedSkills.has(entry.id);
      const restored = await loadLastRun(userJobId, entry.id);
      if (restored) {
        setCompletedSkills(prev => new Set(prev).add(entry.id));
        return;
      }

      if (wasCompleted) {
        toast.error(
          'Could not load your saved result. Try again in a moment, or use Re-run if it still fails.',
        );
        reset();
        setActiveSkill(entry.id);
        return;
      }

      await runSkill(entry);
    },
    [
      activeSkill,
      completedSkills,
      data,
      isLoading,
      loadLastRun,
      prepareSkill,
      needsAnswer,
      handleDeepEvaluation,
      openJobEvaluation,
      reset,
      runSkill,
      state,
      userJobId,
      job,
      jobsList?.items,
    ],
  );

  const handlePanelRerun = useCallback(() => {
    if (!activeEntry) return;
    void runSkill(activeEntry, { forceRefresh: true });
  }, [activeEntry, runSkill]);

  const jobScopedCount = visibleSkills.length;

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
                  setCompletedSkills(new Set(visibleSkills.map(s => s.id)));
                  toast.success('Background run finished. Open each skill to review results.');
                }}
              />
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {visibleSkills.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant col-span-full">
            No AI skills are available in the <strong>{stageLabel(job.kanbanColumn)}</strong>{' '}
            stage. Move this job to an earlier column to unlock coaching tools.
          </p>
        ) : null}
        {visibleSkills.map(entry => {
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

      {jobScopedCount > 0 && (
        <p className="font-body-sm text-body-sm text-secondary -mt-2">
          {jobScopedCount} skill{jobScopedCount === 1 ? '' : 's'} available for the{' '}
          <strong>{stageLabel(job.kanbanColumn)}</strong> stage
        </p>
      )}

      {activeEntry && skillModalOpen && (
        <SkillResultModal
          open={skillModalOpen}
          onClose={() => {
            setSkillModalOpen(false);
            setPanelOpen(false);
            setActiveSkill(null);
            reset();
          }}
          title={activeEntry.label}
          subtitle={`${job.title} · ${job.company}`}
          testId="job-skill-modal"
        >
          {state === 'loading' && (
            <SkillLoadingState label={`Running ${activeEntry.label}…`} />
          )}
          {state !== 'loading' && (
            <SkillPanel
              skillName={activeEntry.id}
              label={activeEntry.label}
              userJobId={userJobId}
              state={activeSkill === (skillName ?? activeSkill) ? state : 'idle'}
              data={activeSkill === (skillName ?? activeSkill) ? data : null}
              error={activeSkill === (skillName ?? activeSkill) ? error : null}
              missingFields={activeSkill === (skillName ?? activeSkill) ? missingFields : []}
              isActive
              open
              onRun={handlePanelRerun}
              onDismissAlert={reset}
              onClose={() => {
                setSkillModalOpen(false);
                setPanelOpen(false);
              }}
              runHistory={runHistory}
              historyIndex={historyIndex}
              onHistoryIndexChange={setHistoryIndex}
            />
          )}
        </SkillResultModal>
      )}

      <CompareJobsModal
        open={comparePickerOpen}
        jobs={jobsList?.items ?? []}
        onClose={() => setComparePickerOpen(false)}
        onConfirm={ids => void handleCompareConfirm(ids)}
      />

      <ApplyAssistModal open={applyAssistOpen} onClose={() => setApplyAssistOpen(false)} job={job} />
      <OutreachDraftModal open={outreachOpen} onClose={() => setOutreachOpen(false)} job={job} />

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
