import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { SkillResultModal } from '@/components/ui/SkillResultModal';
import { getUserFacingErrorMessage } from '@/lib/userFacingError';
import { skillsApi } from '@/services/skillsApi';
import type { JobDetail } from '@/types';

type AnswerEntry = {
  id: string;
  question: string;
  answer: string;
  ranAt: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  job: JobDetail;
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ApplyAssistModal({ open, onClose, job }: Props) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<AnswerEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = history.find(h => h.id === activeId) ?? history[0];
  const prior = history.filter(h => h.id !== active?.id);

  const runAnswer = useCallback(
    async (q: string, rerun = false) => {
      const trimmed = q.trim();
      if (!trimmed) {
        toast.error('Paste an application question first.');
        return;
      }
      setLoading(true);
      try {
        const result = await skillsApi.applyQuestionAnswer(job.userJobId, trimmed, rerun);
        const entry: AnswerEntry = {
          id: newId(),
          question: trimmed,
          answer: result.answer,
          ranAt: new Date().toISOString(),
        };
        setHistory(prev => [entry, ...prev]);
        setActiveId(entry.id);
        setQuestion('');
        toast.success(rerun ? 'New answer ready.' : 'Answer ready — copy and paste into the form.');
      } catch (e) {
        toast.error(getUserFacingErrorMessage(e, 'Could not generate an answer. Please try again.'));
      } finally {
        setLoading(false);
      }
    },
    [job.userJobId],
  );

  return (
    <SkillResultModal
      open={open}
      onClose={onClose}
      title="Apply Assistant"
      subtitle={`${job.title} · ${job.company}`}
      testId="apply-assist-modal"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <p className="font-body-md text-body-md text-on-surface-variant mb-4">
        Paste each question from the employer&apos;s application form. Answers are grounded in your CV and profile —
        not generic templates.
      </p>

      <label className="block font-label-md text-label-md text-on-surface mb-2" htmlFor="apply-question">
        Application question
      </label>
      <textarea
        id="apply-question"
        className="input apply-assist-textarea w-full text-sm mb-3"
        placeholder="e.g. Tell us about a time you worked under pressure to deliver a critical backend release."
        value={question}
        onChange={e => setQuestion(e.target.value)}
        disabled={loading}
        rows={5}
      />

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          disabled={loading || !question.trim()}
          className="btn btn-primary inline-flex items-center gap-2"
          onClick={() => void runAnswer(question, false)}
        >
          {loading ? (
            <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
          )}
          Get answer
        </button>
        {active && (
          <>
            <button
              type="button"
              disabled={loading}
              className="btn btn-secondary"
              onClick={() => void runAnswer(active.question, true)}
            >
              Re-run (different wording)
            </button>
            <button
              type="button"
              disabled={loading}
              className="btn btn-secondary"
              onClick={() => {
                setQuestion('');
                setActiveId(null);
              }}
            >
              Next question
            </button>
          </>
        )}
      </div>

      {loading && (
        <div
          className="rounded-xl border border-primary/20 bg-primary/5 p-6 flex items-center gap-3 mb-4"
          role="status"
          data-testid="apply-assist-loading"
        >
          <span className="material-symbols-outlined text-primary animate-spin">progress_activity</span>
          <span className="font-body-md text-body-md text-on-surface">Writing your answer…</span>
        </div>
      )}

      {active && !loading && (
        <div className="space-y-4" data-testid="apply-assist-answer">
          <div>
            <p className="font-label-sm text-label-sm text-secondary uppercase mb-1">Question</p>
            <p className="font-body-md text-body-md text-on-surface">{active.question}</p>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="font-label-sm text-label-sm text-secondary uppercase">Suggested answer</p>
              <button
                type="button"
                className="text-primary font-label-sm hover:underline"
                onClick={() => {
                  void navigator.clipboard.writeText(active.answer);
                  toast.success('Copied to clipboard');
                }}
              >
                Copy
              </button>
            </div>
            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 font-body-md text-body-md text-on-surface whitespace-pre-wrap leading-relaxed">
              {active.answer}
            </div>
            <p className="font-body-sm text-body-sm text-secondary mt-2">
              Generated {new Date(active.ranAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {prior.length > 0 && (
        <div className="mt-6 border-t border-outline-variant pt-4">
          <p className="font-label-md text-label-md text-on-surface mb-2">Previous answers</p>
          <div className="space-y-2">
            {prior.map(entry => (
              <details key={entry.id} className="rounded-lg border border-outline-variant bg-surface-container-low">
                <summary className="cursor-pointer px-3 py-2 font-body-sm text-body-sm text-on-surface">
                  {entry.question.slice(0, 80)}
                  {entry.question.length > 80 ? '…' : ''}
                  <span className="text-secondary ml-2">
                    · {new Date(entry.ranAt).toLocaleString()}
                  </span>
                </summary>
                <div className="px-3 pb-3 font-body-sm text-body-sm text-on-surface-variant whitespace-pre-wrap">
                  {entry.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </SkillResultModal>
  );
}
