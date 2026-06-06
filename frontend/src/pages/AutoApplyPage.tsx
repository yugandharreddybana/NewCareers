import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  Edit2,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { PageMeta } from '@/components/PageMeta';
import { PageLoader } from '@/components/LoadingSpinner';
import {
  autoApplyApi,
  type AnswerBankEntry,
  type ApplicationRun,
} from '@/services/autoApplyApi';

type AnswerCategory = 'experience' | 'education' | 'skills' | 'personal' | 'other';
type AutoApplyRunStatus = 'pending' | 'running' | 'awaiting_approval' | 'submitted' | 'failed' | 'cancelled';

interface AutoApplyAnswer {
  id: string;
  question: string;
  answer: string;
  category: AnswerCategory;
}

interface AutoApplyRun {
  id: string;
  userJobId: string;
  jobTitle: string;
  company: string;
  status: AutoApplyRunStatus;
  steps: ApplicationRun['steps'];
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

const STATUS_META: Record<AutoApplyRunStatus, { label: string; color: string; icon: LucideIcon; animate?: boolean }> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-600', icon: Clock },
  running: { label: 'Running', color: 'bg-blue-100 text-blue-600', icon: RefreshCw, animate: true },
  awaiting_approval: { label: 'Needs Approval', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  submitted: { label: 'Submitted', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-600', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: X },
};

const CATEGORY_COLORS: Record<AnswerCategory, string> = {
  experience: 'bg-blue-100 text-blue-700',
  education: 'bg-purple-100 text-purple-700',
  skills: 'bg-emerald-100 text-emerald-700',
  personal: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-600',
};

const humanizeQuestionKey = (questionKey: string) =>
  questionKey
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const inferAnswerCategory = (questionKey: string): AnswerCategory => {
  const normalized = questionKey.toLowerCase();
  if (/(react|node|java|python|skill|experience|years)/.test(normalized)) return 'skills';
  if (/(degree|education|university|college|msc|bsc|phd)/.test(normalized)) return 'education';
  if (/(notice|relocate|work|visa|sponsorship|salary|personal)/.test(normalized)) return 'personal';
  if (/(employment|history|career)/.test(normalized)) return 'experience';
  return 'other';
};

const normalizeRunStatus = (status: ApplicationRun['status']): AutoApplyRunStatus => {
  switch (status) {
    case 'in_progress':
      return 'running';
    case 'completed':
      return 'submitted';
    default:
      return status;
  }
};

const toAnswerRecord = (entry: AnswerBankEntry): AutoApplyAnswer => ({
  id: entry.id,
  question: humanizeQuestionKey(entry.questionKey),
  answer: entry.answerText,
  category: inferAnswerCategory(entry.questionKey),
});

const toRunRecord = (run: ApplicationRun): AutoApplyRun => ({
  id: run.id,
  userJobId: run.userJobId,
  jobTitle: `Job ${run.userJobId.slice(0, 8)}`,
  company: 'NewCareers tracked application',
  status: normalizeRunStatus(run.status),
  steps: run.steps,
  startedAt: run.createdAt,
  completedAt: run.submittedAt,
  errorMessage: run.errorMessage,
});

const AnswerRow = ({
  answer,
  onSave,
  onDelete,
}: {
  answer: AutoApplyAnswer;
  onSave: (answer: AutoApplyAnswer) => void;
  onDelete: (id: string) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(answer.answer);

  const handleSave = () => {
    onSave({ ...answer, answer: value });
    setEditing(false);
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-1">{answer.question}</p>
        {editing ? (
          <input
            autoFocus
            value={value}
            onChange={event => setValue(event.target.value)}
            aria-label="Edit auto-apply answer"
            className="w-full px-2.5 py-1.5 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        ) : (
          <p className="text-sm font-semibold text-gray-900">{answer.answer}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${CATEGORY_COLORS[answer.category]}`}>{answer.category}</span>
        {editing ? (
          <>
            <button aria-label="Save answer" title="Save answer" onClick={handleSave} className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50"><Save size={13} /></button>
            <button aria-label="Cancel editing" title="Cancel editing" onClick={() => { setValue(answer.answer); setEditing(false); }} className="p-1.5 rounded text-gray-400 hover:bg-gray-50"><X size={13} /></button>
          </>
        ) : (
          <>
            <button aria-label="Edit answer" title="Edit answer" onClick={() => setEditing(true)} className="p-1.5 rounded text-gray-400 hover:text-indigo-500 hover:bg-indigo-50"><Edit2 size={13} /></button>
            <button aria-label="Delete answer" title="Delete answer" onClick={() => onDelete(answer.id)} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
          </>
        )}
      </div>
    </div>
  );
};

const AddAnswerForm = ({ onAdd }: { onAdd: (answer: AutoApplyAnswer) => void }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState<AnswerCategory>('personal');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!question.trim() || !answer.trim()) {
      toast.error('Question and answer are required.');
      return;
    }

    setSaving(true);
    try {
      const result = toAnswerRecord(await autoApplyApi.upsertAnswer({
        questionKey: question,
        answerText: answer,
      }));
      onAdd(result);
      setQuestion('');
      setAnswer('');
      setCategory('personal');
      toast.success('Answer added to bank.');
    } catch {
      toast.error('Failed to save answer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-700">Add New Answer</p>
      <input
        value={question}
        onChange={event => setQuestion(event.target.value)}
        placeholder="Question text..."
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <div className="flex gap-2">
        <input
          value={answer}
          onChange={event => setAnswer(event.target.value)}
          placeholder="Your answer..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <select
          value={category}
          onChange={event => setCategory(event.target.value as AnswerCategory)}
          aria-label="Answer category"
          className="px-2 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {(['experience', 'education', 'skills', 'personal', 'other'] as const).map(item => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Add answer"
          title="Add answer"
          onClick={handleAdd}
          disabled={saving}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors"
        >
          {saving ? '...' : <Plus size={14} />}
        </button>
      </div>
    </div>
  );
};

const RunCard = ({
  run,
  onApprove,
  onRetry,
}: {
  run: AutoApplyRun;
  onApprove: (id: string) => void;
  onRetry: (id: string) => void;
}) => {
  const meta = STATUS_META[run.status];
  const StatusIcon = meta.icon;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
      <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
        <PlayCircle size={17} className="text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">{run.jobTitle}</p>
          <span className="text-xs text-gray-400">@ {run.company}</span>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${meta.color}`}>
            <StatusIcon size={11} className={meta.animate ? 'animate-spin' : undefined} /> {meta.label}
          </span>
          {run.errorMessage && <span className="text-[11px] text-red-500">{run.errorMessage}</span>}
          <span className="text-[10px] text-gray-400">{new Date(run.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        {run.status === 'awaiting_approval' && (
          <button onClick={() => onApprove(run.id)} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors">
            Approve
          </button>
        )}
        {run.status === 'failed' && (
          <button onClick={() => onRetry(run.id)} className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors">
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

const AutoApplyPage = () => {
  const [answers, setAnswers] = useState<AutoApplyAnswer[]>([]);
  const [history, setHistory] = useState<AutoApplyRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'answers' | 'history'>('answers');

  useEffect(() => {
    const load = async () => {
      try {
        const [answerEntries, runResponse] = await Promise.all([
          autoApplyApi.listAnswers(),
          autoApplyApi.listRuns(),
        ]);
        setAnswers(answerEntries.map(toAnswerRecord));
        setHistory(runResponse.runs.map(toRunRecord));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleSaveAnswer = async (updated: AutoApplyAnswer) => {
    try {
      const saved = toAnswerRecord(await autoApplyApi.upsertAnswer({
        questionKey: updated.question,
        answerText: updated.answer,
      }));
      setAnswers(prev => prev.map(answer => answer.id === updated.id ? saved : answer));
      toast.success('Answer updated.');
    } catch {
      toast.error('Failed to update answer.');
    }
  };

  const handleDeleteAnswer = async (id: string) => {
    try {
      await autoApplyApi.deleteAnswer(id);
      setAnswers(prev => prev.filter(answer => answer.id !== id));
      toast.success('Answer removed.');
    } catch {
      toast.error('Failed to delete answer.');
    }
  };

  const handleApprove = async (runId: string) => {
    try {
      const updated = toRunRecord(await autoApplyApi.approveRun(runId, true));
      if (!updated) return;

      setHistory(prev => prev.map(run => run.id === runId ? { ...updated, status: 'submitted' } : run));
      toast.success('Application approved for submission!');
    } catch {
      toast.error('Failed to approve.');
    }
  };

  const handleRetry = async (runId: string) => {
    try {
      const updated = toRunRecord(await autoApplyApi.retryRun(runId));
      if (!updated) return;

      setHistory(prev => prev.map(run => run.id === runId ? { ...updated, status: 'running' } : run));
      toast.success('Retry started.');
    } catch {
      toast.error('Failed to retry.');
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  const pendingApprovals = history.filter(run => run.status === 'awaiting_approval').length;

  return (
    <>
      <PageMeta title="Auto-Apply - NewCareers" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Auto-Apply</h1>
            <p className="text-sm text-gray-500 mt-1">AI-powered browser agent that fills and submits applications on your behalf.</p>
          </div>
          {pendingApprovals > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-2 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg">
              <AlertTriangle size={13} /> {pendingApprovals} needs approval
            </span>
          )}
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-indigo-800 mb-2">How Auto-Apply works</p>
          <div className="flex items-center gap-2 flex-wrap">
            {['1. AI fills the form', '2. You review & approve', '3. Agent submits'].map((step, index) => (
              <span key={index} className="flex items-center gap-1 text-xs text-indigo-700">
                {step} {index < 2 && <ChevronRight size={12} className="text-indigo-400" />}
              </span>
            ))}
          </div>
        </div>

        <div className="flex border-b border-gray-200">
          {(['answers', 'history'] as const).map(currentTab => (
            <button
              key={currentTab}
              onClick={() => setTab(currentTab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
                tab === currentTab ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {currentTab === 'answers' ? 'Answer Bank' : 'Run History'}
              {currentTab === 'history' && pendingApprovals > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-amber-400 text-white text-[10px] font-bold rounded-full">{pendingApprovals}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'answers' && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-700 mb-1">Answer Bank ({answers.length} answers)</p>
              <p className="text-xs text-gray-400 mb-4">Pre-filled answers used by the agent when it encounters common application questions.</p>
              {answers.map(answer => (
                <AnswerRow key={answer.id} answer={answer} onSave={handleSaveAnswer} onDelete={handleDeleteAnswer} />
              ))}
              {answers.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No answers yet.</p>}
            </div>
            <AddAnswerForm onAdd={answer => setAnswers(prev => [...prev, answer])} />
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-3">
            {history.length > 0 ? (
              history.map(run => <RunCard key={run.id} run={run} onApprove={handleApprove} onRetry={handleRetry} />)
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
                <Zap size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No auto-apply runs yet. Start one from the Job Detail page.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default AutoApplyPage;