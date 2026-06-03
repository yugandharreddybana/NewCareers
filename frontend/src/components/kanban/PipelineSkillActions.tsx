import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useJobsList } from '@/hooks/queries';
import { useSkill } from '@/hooks/useSkill';
import { getSkillCatalogItem, PIPELINE_SKILL_IDS } from '@/lib/skillCatalog';
import { SkillResultModal } from '@/components/ui/SkillResultModal';
import { SkillPanel } from '@/components/skills';
import { SkillLoadingState } from '@/components/skills/SkillLoadingState';
import { CompareJobsModal } from '@/components/kanban/CompareJobsModal';

type Props = {
  className?: string;
};

export function PipelineSkillActions({ className = '' }: Props) {
  const { data: jobsList } = useJobsList();
  const items = jobsList?.items ?? [];
  const {
    state,
    data,
    error,
    missingFields,
    startSkill,
    reset,
  } = useSkill();

  const [activeId, setActiveId] = useState<(typeof PIPELINE_SKILL_IDS)[number] | null>(null);
  const [comparePickerOpen, setComparePickerOpen] = useState(false);

  const runCompare = useCallback(
    async (compareJobIds: string[]) => {
      setComparePickerOpen(false);
      setActiveId('compare');
      reset();
      await startSkill({ skillName: 'compare', compareJobIds, forceRefresh: true });
    },
    [reset, startSkill],
  );

  const runPipelineSkill = useCallback(
    async (id: (typeof PIPELINE_SKILL_IDS)[number]) => {
      if (id === 'compare') {
        if (items.filter(j => j.userJobId && j.kanbanColumn !== 'Rejected').length < 2) {
          toast.error('Save at least two jobs to compare.');
          return;
        }
        setComparePickerOpen(true);
        return;
      }

      setActiveId(id);
      reset();
      if (id === 'triage') {
        await startSkill({ skillName: 'triage', forceRefresh: true });
      }
    },
    [items, reset, startSkill],
  );

  const handleRerun = useCallback(() => {
    if (!activeId) return;
    if (activeId === 'compare') {
      setComparePickerOpen(true);
      return;
    }
    void runPipelineSkill(activeId);
  }, [activeId, runPipelineSkill]);

  const activeEntry = activeId ? getSkillCatalogItem(activeId) : undefined;
  const modalOpen = activeId !== null && (state === 'loading' || state === 'done' || state === 'error');

  return (
    <>
      <div className={`inline-flex flex-row flex-nowrap items-center gap-2 ${className}`}>
        {PIPELINE_SKILL_IDS.map(id => {
          const entry = getSkillCatalogItem(id);
          if (!entry) return null;
          return (
            <button
              key={id}
              type="button"
              disabled={state === 'loading' && activeId === id}
              onClick={() => void runPipelineSkill(id)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface font-label-md hover:border-primary/40 hover:bg-surface-container-low transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">{entry.icon}</span>
              {entry.label}
            </button>
          );
        })}
      </div>

      <CompareJobsModal
        open={comparePickerOpen}
        jobs={items}
        onClose={() => setComparePickerOpen(false)}
        onConfirm={ids => void runCompare(ids)}
      />

      {activeEntry && (
        <SkillResultModal
          open={modalOpen}
          onClose={() => {
            setActiveId(null);
            reset();
          }}
          title={activeEntry.label}
          subtitle="Pipeline-wide analysis"
          testId="pipeline-skill-modal"
        >
          {state === 'loading' && (
            <SkillLoadingState label={`Running ${activeEntry.label}…`} />
          )}
          {state !== 'loading' && (
            <SkillPanel
              skillName={activeEntry.id}
              label={activeEntry.label}
              state={state}
              data={data}
              error={error}
              missingFields={missingFields}
              isActive
              open
              onRun={handleRerun}
              onDismissAlert={reset}
            />
          )}
        </SkillResultModal>
      )}
    </>
  );
}
