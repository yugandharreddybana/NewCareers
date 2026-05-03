import React, { useEffect, useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { autoApplyApi, type AutoApplyAnswer, type AutoApplyRun, type AutoApplyRunStatus } from '@/services/autoApplyApi';
import * as mocks from '@/services/mockApi';
import toast from 'react-hot-toast';
import {
  Zap, CheckCircle, XCircle, Clock, AlertTriangle,
  Plus, Trash2, Edit2, Save, X, RefreshCw,
  PlayCircle, ChevronRight,
} from 'lucide-react';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

const MOCK_ANSWERS: AutoApplyAnswer[] = [
  { id: 'a-1', question: 'Do you have the right to work in Ireland?',   answer: 'Yes',              category: 'personal' },
  { id: 'a-2', question: 'Years of experience with React?',             answer: '4',                category: 'skills' },
  { id: 'a-3', question: 'What is your notice period?',                 answer: '4 weeks',          category: 'personal' },
  { id: 'a-4', question: 'Are you willing to relocate?',                answer: 'Within Ireland',   category: 'personal' },
  { id: 'a-5', question: 'Highest level of education?',                 answer: 'MSc Data Analytics', category: 'education' },
];

const MOCK_HISTORY: AutoApplyRun[] = [
  { id: 'run-1', userJobId: 'uj-1', jobTitle: 'Senior Frontend Engineer', company: 'TechWave Ireland', status: 'submitted', steps: [], startedAt: new Date(Date.now() - 3600000).toISOString(), completedAt: new Date(Date.now() - 3000000).toISOString(), errorMessage: null },
  { id: 'run-2', userJobId: 'uj-2', jobTitle: 'Lead Full Stack Developer', company: 'EcoGrowth',     status: 'awaiting_approval', steps: [], startedAt: new Date(Date.now() - 900000).toISOString(), completedAt: null, errorMessage: null },
  { id: 'run-3', userJobId: 'uj-3', jobTitle: 'Product Designer',          company: 'DesignScale',  status: 'failed',   steps: [], startedAt: new Date(Date.now() - 7200000).toISOString(), completedAt: new Date(Date.now() - 7000000).toISOString(), errorMessage: 'Login wall detected' },
];

const STATUS_META: Record<AutoApplyRunStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:           { label: 'Pending',           color: 'bg-gray-100 text-gray-600',   icon: <Clock size={11} /> },
  running:           { label: 'Running',           color: 'bg-blue-100 text-blue-600',   icon: <RefreshCw size={11} className="animate-spin" /> },
  awaiting_approval: { label: 'Needs Approval',    color: 'bg-amber-100 text-amber-700', icon: <AlertTriangle size={11} /> },
  approved:          { label: 'Approved',          color: 'bg-indigo-100 text-indigo-700', icon: <CheckCircle size={11} /> },
  submitted:         { label: 'Submitted',         color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={11} /> },
  failed:            { label: 'Failed',            color: 'bg-red-100 text-red-600',     icon: <XCircle size={11} /> },
  cancelled:         { label: 'Cancelled',         color: 'bg-gray-100 text-gray-500',   icon: <X size={11} /> },
};

const CATEGORY_COLORS: Record<AutoApplyAnswer['category'], string> = {
  experience: 'bg-blue-100 text-blue-700',
  education:  'bg-purple-100 text-purple-700',
  skills:     'bg-emerald-100 text-emerald-700',
  personal:   'bg-orange-100 text-orange-700',
  other:      'bg-gray-100 text-gray-600',
};

// ── Answer editor row ─────────────────────────────────────────────────────────
const AnswerRow: React.FC<{
  answer: AutoApplyAnswer;
  onSave: (a: AutoApplyAnswer) => void;
  onDelete: (id: string) => void;
}> = ({ answer, onSave, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(answer.answer);

  const handleSave = () => { onSave({ ...answer, answer: val }); setEditing(false); };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-1">{answer.question}</p>
        {editing ? (
          <input autoFocus value={val} onChange={e => setVal(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        ) : (
          <p className="text-sm font-semibold text-gray-900">{answer.answer}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${CATEGORY_COLORS[answer.category]}`}>{answer.category}</span>
        {editing ? (
          <>
            <button onClick={handleSave} className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50"><Save size={13} /></button>
            <button onClick={() => { setVal(answer.answer); setEditing(false); }} className="p-1.5 rounded text-gray-400 hover:bg-gray-50"><X size={13} /></button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="p-1.5 rounded text-gray-400 hover:text-indigo-500 hover:bg-indigo-50"><Edit2 size={13} /></button>
            <button onClick={() => onDelete(answer.id)} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
          </>
        )}
      </div>
    </div>
  );
};

// ── Add answer form ───────────────────────────────────────────────────────────
const AddAnswerForm: React.FC<{ onAdd: (a: AutoApplyAnswer) => void }> = ({ onAdd }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer]     = useState('');
  const [category, setCategory] = useState<AutoApplyAnswer['category']>('personal');
  const [saving, setSaving]     = useState(false);

  const handleAdd = async () => {
    if (!question.trim() || !answer.trim()) { toast.error('Question and answer are required.'); return; }
    setSaving(true);
    try {
      const res = USE_MOCKS
        ? { id: `a-${Date.now()}`, question, answer, category }
        : await autoApplyApi.upsertAnswer({ question, answer, category });
      onAdd(res);
      setQuestion(''); setAnswer(''); setCategory('personal');
      toast.success('Answer added to bank.');
    } catch { toast.error('Failed to save answer.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-700">Add New Answer</p>
      <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Question text…"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      <div className="flex gap-2">
        <input value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Your answer…"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <select value={category} onChange={e => setCategory(e.target.value as AutoApplyAnswer['category'])}
          className="px-2 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400">
          {(['experience','education','skills','personal','other'] as const).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={handleAdd} disabled={saving}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors">
          {saving ? '…' : <Plus size={14} />}
        </button>
      </div>
    </div>
  );
};

// ── Run history card ──────────────────────────────────────────────────────────
const RunCard: React.FC<{ run: AutoApplyRun; onApprove: (id: string) => void; onRetry: (id: string) => void }> = ({ run, onApprove, onRetry }) => {
  const meta = STATUS_META[run.status];
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
            {meta.icon} {meta.label}
          </span>
          {run.errorMessage && <span className="text-[11px] text-red-500">{run.errorMessage}</span>}
          <span className="text-[10px] text-gray-400">{new Date(run.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        {run.status === 'awaiting_approval' && (
          <button onClick={() => onApprove(run.id)}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors">
            Approve
          </button>
        )}
        {run.status === 'failed' && (
          <button onClick={() => onRetry(run.id)}
            className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors">
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const AutoApplyPage: React.FC = () => {
  const [answers, setAnswers]   = useState<AutoApplyAnswer[]>([]);
  const [history, setHistory]   = useState<AutoApplyRun[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'answers' | 'history'>('answers');

  useEffect(() => {
    const load = async () => {
      try {
        if (USE_MOCKS) {
          await new Promise(r => setTimeout(r, 500));
          setAnswers(MOCK_ANSWERS);
          setHistory(MOCK_HISTORY);
        } else {
          const [ans, hist] = await Promise.all([
            autoApplyApi.getAnswers().catch(() => MOCK_ANSWERS),
            autoApplyApi.getHistory().catch(() => MOCK_HISTORY),
          ]);
          setAnswers(ans);
          setHistory(hist);
        }
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const handleSaveAnswer = async (updated: AutoApplyAnswer) => {
    try {
      if (!USE_MOCKS) await autoApplyApi.upsertAnswer(updated);
      setAnswers(prev => prev.map(a => a.id === updated.id ? updated : a));
      toast.success('Answer updated.');
    } catch { toast.error('Failed to update answer.'); }
  };

  const handleDeleteAnswer = async (id: string) => {
    try {
      if (!USE_MOCKS) await autoApplyApi.deleteAnswer(id);
      setAnswers(prev => prev.filter(a => a.id !== id));
      toast.success('Answer removed.');
    } catch { toast.error('Failed to delete answer.'); }
  };

  const handleApprove = async (runId: string) => {
    try {
      if (!USE_MOCKS) await autoApplyApi.approve(runId, true);
      setHistory(prev => prev.map(r => r.id === runId ? { ...r, status: 'approved' as AutoApplyRunStatus } : r));
      toast.success('Application approved for submission!');
    } catch { toast.error('Failed to approve.'); }
  };

  const handleRetry = async (runId: string) => {
    try {
      if (!USE_MOCKS) await autoApplyApi.retry(runId);
      setHistory(prev => prev.map(r => r.id === runId ? { ...r, status: 'running' as AutoApplyRunStatus } : r));
      toast.success('Retry started.');
    } catch { toast.error('Failed to retry.'); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">Loading Auto-Apply…</div>;

  const pendingApprovals = history.filter(r => r.status === 'awaiting_approval').length;

  return (
    <>
      <PageMeta title="Auto-Apply — CareerOps" />
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

        {/* How it works banner */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-indigo-800 mb-2">⚡ How Auto-Apply works</p>
          <div className="flex items-center gap-2 flex-wrap">
            {['1. AI fills the form', '2. You review & approve', '3. Agent submits'].map((s, i) => (
              <span key={i} className="flex items-center gap-1 text-xs text-indigo-700">
                {s} {i < 2 && <ChevronRight size={12} className="text-indigo-400" />}
              </span>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['answers', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
                tab === t ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'answers' ? 'Answer Bank' : 'Run History'}
              {t === 'history' && pendingApprovals > 0 && (
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
              {answers.map(a => (
                <AnswerRow key={a.id} answer={a} onSave={handleSaveAnswer} onDelete={handleDeleteAnswer} />
              ))}
              {answers.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No answers yet.</p>}
            </div>
            <AddAnswerForm onAdd={a => setAnswers(prev => [...prev, a])} />
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-3">
            {history.length > 0
              ? history.map(r => <RunCard key={r.id} run={r} onApprove={handleApprove} onRetry={handleRetry} />)
              : <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
                  <Zap size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No auto-apply runs yet. Start one from the Job Detail page.</p>
                </div>
            }
          </div>
        )}

      </div>
    </>
  );
};

export default AutoApplyPage;
