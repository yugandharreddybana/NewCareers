import { useEffect, useState, useCallback } from 'react';
import { autoApplyApi, type AnswerBankEntry, type ApplicationRun } from '@/api/autoApplyApi';
import toast from 'react-hot-toast';
import { Zap, CheckCircle2, Clock, XCircle, AlertCircle, ChevronDown, ChevronRight, Plus, Trash2, Edit2 } from 'lucide-react';

const QUESTION_LABELS: Record<string, string> = {
  work_authorization:  'Work Authorisation',
  salary_expectation:  'Salary Expectation',
  notice_period:       'Notice Period',
  relocation:          'Relocation',
  sponsorship_required:'Sponsorship Required',
  years_experience:    'Years of Experience',
  remote_preference:   'Remote Preference',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed:         <CheckCircle2 size={14} className="text-green-500" />,
  in_progress:       <Clock size={14} className="text-blue-500 animate-pulse" />,
  awaiting_approval: <AlertCircle size={14} className="text-yellow-500" />,
  failed:            <XCircle size={14} className="text-red-500" />,
  cancelled:         <XCircle size={14} className="text-slate-400" />,
  pending:           <Clock size={14} className="text-slate-300" />,
};

const STATUS_BADGE: Record<string, string> = {
  completed:         'bg-green-100 text-green-700',
  in_progress:       'bg-blue-100 text-blue-700',
  awaiting_approval: 'bg-yellow-100 text-yellow-700',
  failed:            'bg-red-100 text-red-700',
  cancelled:         'bg-slate-100 text-slate-500',
  pending:           'bg-slate-100 text-slate-500',
};

export default function AutoApplyPage() {
  const [answers, setAnswers]       = useState<AnswerBankEntry[]>([]);
  const [runs, setRuns]             = useState<ApplicationRun[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<'answers' | 'history'>('answers');
  const [editKey, setEditKey]       = useState<string | null>(null);
  const [editVal, setEditVal]       = useState('');
  const [addKey, setAddKey]         = useState('');
  const [addVal, setAddVal]         = useState('');
  const [showAdd, setShowAdd]       = useState(false);
  const [expanded, setExpanded]     = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([
        autoApplyApi.listAnswers(),
        autoApplyApi.listRuns(),
      ]);
      setAnswers(a);
      setRuns(r.runs);
    } catch {
      toast.error('Failed to load auto-apply data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSaveEdit(entry: AnswerBankEntry) {
    try {
      const updated = await autoApplyApi.upsertAnswer({ questionKey: entry.questionKey, answerText: editVal });
      setAnswers(prev => prev.map(a => a.id === entry.id ? updated : a));
      setEditKey(null);
      toast.success('Answer updated');
    } catch {
      toast.error('Failed to save');
    }
  }

  async function handleAddAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!addKey.trim() || !addVal.trim()) return;
    try {
      const created = await autoApplyApi.upsertAnswer({ questionKey: addKey.trim(), answerText: addVal.trim() });
      setAnswers(prev => {
        const idx = prev.findIndex(a => a.questionKey === created.questionKey);
        return idx >= 0 ? prev.map((a, i) => i === idx ? created : a) : [...prev, created];
      });
      setAddKey(''); setAddVal(''); setShowAdd(false);
      toast.success('Answer added');
    } catch {
      toast.error('Failed to add answer');
    }
  }

  async function handleDeleteAnswer(id: string) {
    try {
      await autoApplyApi.deleteAnswer(id);
      setAnswers(prev => prev.filter(a => a.id !== id));
      toast.success('Removed');
    } catch {
      toast.error('Failed to remove');
    }
  }

  async function handleApprove(runId: string, approved: boolean) {
    try {
      const updated = await autoApplyApi.approveRun(runId, approved);
      setRuns(prev => prev.map(r => r.id === runId ? updated : r));
      toast.success(approved ? 'Application submitted!' : 'Run cancelled');
    } catch {
      toast.error('Failed to update run');
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
          <Zap size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Auto-Apply Assistant</h1>
          <p className="text-sm text-text-tertiary">
            Semi-automated application flows with guardrails and approval checkpoints
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-raised rounded-xl p-1 w-fit">
        {(['answers', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === t ? 'bg-white shadow-sm text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
                  }`}>
            {t === 'answers' ? 'Answer Bank' : 'Run History'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-text-tertiary">Loading…</div>
      ) : tab === 'answers' ? (
        <AnswerBankTab
          answers={answers}
          editKey={editKey}
          editVal={editVal}
          showAdd={showAdd}
          addKey={addKey}
          addVal={addVal}
          onEdit={(a) => { setEditKey(a.questionKey); setEditVal(a.answerText); }}
          onEditChange={setEditVal}
          onEditSave={handleSaveEdit}
          onEditCancel={() => setEditKey(null)}
          onDelete={handleDeleteAnswer}
          onShowAdd={() => setShowAdd(s => !s)}
          onAddKey={setAddKey}
          onAddVal={setAddVal}
          onAddSubmit={handleAddAnswer}
          onAddCancel={() => setShowAdd(false)}
        />
      ) : (
        <RunHistoryTab
          runs={runs}
          expanded={expanded}
          onExpand={(id) => setExpanded(e => ({ ...e, [id]: !e[id] }))}
          onApprove={handleApprove}
        />
      )}
    </div>
  );
}

function AnswerBankTab({
  answers, editKey, editVal, showAdd, addKey, addVal,
  onEdit, onEditChange, onEditSave, onEditCancel,
  onDelete, onShowAdd, onAddKey, onAddVal, onAddSubmit, onAddCancel,
}: {
  answers: AnswerBankEntry[];
  editKey: string | null;
  editVal: string;
  showAdd: boolean;
  addKey: string;
  addVal: string;
  onEdit: (a: AnswerBankEntry) => void;
  onEditChange: (v: string) => void;
  onEditSave: (a: AnswerBankEntry) => void;
  onEditCancel: () => void;
  onDelete: (id: string) => void;
  onShowAdd: () => void;
  onAddKey: (v: string) => void;
  onAddVal: (v: string) => void;
  onAddSubmit: (e: React.FormEvent) => void;
  onAddCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-tertiary">
          Pre-saved answers the AI uses to fill standard application questions automatically.
        </p>
        <button onClick={onShowAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 text-white rounded-lg
                           text-xs font-medium hover:bg-brand-600 transition-colors">
          <Plus size={13} /> Add Answer
        </button>
      </div>

      {showAdd && (
        <form onSubmit={onAddSubmit}
              className="bg-white border border-border rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">Question key</label>
              <input className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                     placeholder="e.g. linkedin_url"
                     value={addKey} onChange={e => onAddKey(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">Answer</label>
              <input className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                     placeholder="Your answer"
                     value={addVal} onChange={e => onAddVal(e.target.value)} required />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit"
                    className="px-3 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-medium">
              Save
            </button>
            <button type="button" onClick={onAddCancel}
                    className="px-3 py-1.5 border border-border rounded-lg text-xs">
              Cancel
            </button>
          </div>
        </form>
      )}

      {answers.length === 0 ? (
        <div className="text-center py-12 text-text-tertiary">No answers saved yet.</div>
      ) : (
        <div className="bg-white border border-border rounded-xl divide-y divide-border">
          {answers.map(a => (
            <div key={a.id} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-text-tertiary mb-0.5">
                  {QUESTION_LABELS[a.questionKey] ?? a.questionKey}
                </p>
                {editKey === a.questionKey ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      className="flex-1 border border-brand-300 rounded px-2 py-1 text-sm"
                      value={editVal}
                      onChange={e => onEditChange(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => onEditSave(a)}
                            className="px-2 py-1 bg-brand-500 text-white rounded text-xs">Save</button>
                    <button onClick={onEditCancel}
                            className="px-2 py-1 border border-border rounded text-xs">Cancel</button>
                  </div>
                ) : (
                  <p className="text-sm text-text-primary">{a.answerText}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onEdit(a)}
                        className="p-1.5 text-text-tertiary hover:text-brand-500 transition-colors">
                  <Edit2 size={13} />
                </button>
                <button onClick={() => onDelete(a.id)}
                        className="p-1.5 text-text-tertiary hover:text-danger-500 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RunHistoryTab({
  runs, expanded, onExpand, onApprove,
}: {
  runs: ApplicationRun[];
  expanded: Record<string, boolean>;
  onExpand: (id: string) => void;
  onApprove: (id: string, approved: boolean) => void;
}) {
  if (runs.length === 0) {
    return (
      <div className="text-center py-16">
        <Zap size={40} className="mx-auto text-text-tertiary mb-3" />
        <p className="text-text-secondary font-medium">No runs yet</p>
        <p className="text-sm text-text-tertiary mt-1">
          Start a run from a job card in your Tracker.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map(run => (
        <div key={run.id} className="bg-white border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => onExpand(run.id)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-raised
                       transition-colors text-left"
          >
            {STATUS_ICON[run.status] ?? STATUS_ICON.pending}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">
                  Run {run.id.slice(0, 8)}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[run.status]}`}>
                  {run.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-text-tertiary mt-0.5">
                {run.completedSteps}/{run.totalSteps} steps ·{' '}
                {new Date(run.createdAt).toLocaleDateString()}
              </p>
            </div>
            {expanded[run.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {expanded[run.id] && (
            <div className="border-t border-border px-4 py-4 space-y-3">
              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div
                  className="bg-brand-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(run.completedSteps / Math.max(run.totalSteps, 1)) * 100}%` }}
                />
              </div>

              {/* Steps */}
              <div className="space-y-2">
                {run.steps.map(s => (
                  <div key={s.id} className="flex items-center gap-3 text-sm">
                    {STATUS_ICON[s.status] ?? STATUS_ICON.pending}
                    <span className={s.status === 'completed'
                      ? 'text-text-primary'
                      : s.status === 'in_progress'
                      ? 'text-blue-600 font-medium'
                      : 'text-text-tertiary'
                    }>
                      {s.stepNumber}. {s.description}
                    </span>
                    {s.executedAt && (
                      <span className="text-[11px] text-text-tertiary ml-auto">
                        {new Date(s.executedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Approval buttons */}
              {run.status === 'awaiting_approval' && (
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <p className="text-sm text-text-secondary flex-1">
                    Review complete — approve to submit or cancel.
                  </p>
                  <button
                    onClick={() => onApprove(run.id, false)}
                    className="px-3 py-1.5 border border-border rounded-lg text-sm text-text-secondary
                               hover:bg-danger-50 hover:text-danger-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onApprove(run.id, true)}
                    className="px-4 py-1.5 bg-brand-500 text-white rounded-lg text-sm font-medium
                               hover:bg-brand-600 transition-colors"
                  >
                    Submit Application
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
