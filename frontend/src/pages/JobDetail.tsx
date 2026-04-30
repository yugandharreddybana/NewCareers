import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { jobsApi, kanbanApi } from '@/services/api';
import { JobDetail as JD } from '@/types';
import MatchCircle from '@/components/ui/MatchCircle';
import { useSkill } from '@/hooks/useSkill';
import SkillPanel from '@/components/skills/SkillPanel';
import SkillQuestionModal from '@/components/skills/SkillQuestionModal';
import RunAllSkillsButton from '@/components/skills/RunAllSkillsButton';
import ProfileCompletenessAlert from '@/components/skills/ProfileCompletenessAlert';
import {
  Building2, MapPin, Calendar, Euro, ShieldCheck,
  ExternalLink, Sparkles, CheckCircle2, AlertCircle,
  Bookmark, Send, Zap, FileDown, ChevronRight,
  Brain, ClipboardList, Layers,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// All 9 skills — extend this array when Phase 2 Section 4 adds the new 5
// ─────────────────────────────────────────────────────────────────────────────
const ALL_SKILLS = [
  { name: 'evaluate',       label: 'Full Evaluation' },
  { name: 'tailor-resume',  label: 'Tailor My CV' },
  { name: 'research',       label: 'Research Company' },
  { name: 'outreach',       label: 'Draft Outreach' },
  { name: 'apply',          label: 'Apply Assistant' },
  { name: 'prep-interview', label: 'Prep Interview' },
  { name: 'compare',        label: 'Compare Jobs' },
  { name: 'triage',         label: 'Quick Triage' },
  { name: 'scan',           label: 'CV Scan' },
] as const;

type SkillName = typeof ALL_SKILLS[number]['name'];
type Tab = 'overview' | 'ai-tools' | 'apply';

// ─── Source badge helpers ────────────────────────────────────────────────────
const SOURCE_STYLES: Record<string, string> = {
  'LinkedIn (Twin AI)': 'bg-blue-50 text-blue-700 border-blue-200',
  'IrishJobs':          'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Jobs.ie':            'bg-teal-50 text-teal-700 border-teal-200',
  'Reed':               'bg-red-50 text-red-700 border-red-200',
  'Adzuna':             'bg-orange-50 text-orange-700 border-orange-200',
  'Remotive':           'bg-purple-50 text-purple-700 border-purple-200',
  'TheMuse':            'bg-pink-50 text-pink-700 border-pink-200',
  'Jobicy':             'bg-yellow-50 text-yellow-700 border-yellow-200',
};
function getSourceStyle(s?: string) {
  if (!s) return 'bg-slate-50 text-slate-500 border-slate-200';
  const k = Object.keys(SOURCE_STYLES).find(k => s.toLowerCase().includes(k.toLowerCase()));
  return k ? SOURCE_STYLES[k] : 'bg-slate-50 text-slate-500 border-slate-200';
}
function sourceLabel(s?: string) {
  if (!s) return 'Job Board';
  return s.replace(/ Careers$/i, '').trim();
}

// ─── Skill button ─────────────────────────────────────────────────────────────
interface SkillBtnProps {
  label: string;
  status: string;
  hasResult: boolean;
  onClick: () => void;
  onOpen: () => void;
}
function SkillBtn({ label, status, hasResult, onClick, onOpen }: SkillBtnProps) {
  const isLoading = status === 'loading';
  const isDone    = status === 'done';
  const isPending = status === 'pending_answer';
  const isError   = status === 'error';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={isDone && hasResult ? onOpen : onClick}
        disabled={isLoading || isPending}
        className={[
          'flex-1 flex items-center justify-between px-4 h-10 rounded-xl text-sm font-semibold transition-all border',
          isLoading || isPending
            ? 'opacity-60 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400'
            : isDone
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
            : isError
            ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
            : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600',
        ].join(' ')}
      >
        <span>{label}</span>
        <span className="text-xs">
          {isLoading ? '⏳' : isPending ? '💬' : isDone ? '✅' : isError ? '⚠️' : '▶'}
        </span>
      </button>
      {isDone && hasResult && (
        <button
          onClick={onClick}
          title="Re-run skill"
          className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 hover:border-indigo-300 text-xs transition-all"
        >↺</button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob]           = useState<JD | null>(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<Tab>('overview');
  const [openSkill, setOpenSkill] = useState<SkillName | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!id) return;
    jobsApi.detail(id)
      .then(setJob)
      .catch((e: any) => toast.error(e.normalizedMessage || 'Failed to load job'))
      .finally(() => setLoading(false));
  }, [id]);

  // ── One hook per skill ──────────────────────────────────────────────────────
  const evaluate      = useSkill('evaluate',       id ?? '');
  const tailorResume  = useSkill('tailor-resume',  id ?? '');
  const research      = useSkill('research',       id ?? '');
  const outreach      = useSkill('outreach',       id ?? '');
  const applySkill    = useSkill('apply',          id ?? '');
  const prepInterview = useSkill('prep-interview', id ?? '');
  const compare       = useSkill('compare',        id ?? '');
  const triage        = useSkill('triage',         id ?? '');
  const scan          = useSkill('scan',           id ?? '');

  const skillHooks: Record<SkillName, ReturnType<typeof useSkill>> = {
    'evaluate':       evaluate,
    'tailor-resume':  tailorResume,
    'research':       research,
    'outreach':       outreach,
    'apply':          applySkill,
    'prep-interview': prepInterview,
    'compare':        compare,
    'triage':         triage,
    'scan':           scan,
  };

  const pendingConv = ALL_SKILLS
    .map(s => ({ ...s, hook: skillHooks[s.name] }))
    .find(s => s.hook.state.status === 'pending_answer');

  const anySkillDone = ALL_SKILLS.some(s => skillHooks[s.name].state.status === 'done');
  const doneCount    = ALL_SKILLS.filter(s => skillHooks[s.name].state.status === 'done').length;

  // ── PDF download ────────────────────────────────────────────────────────────
  async function downloadPdf(type: 'all' | 'resume' | SkillName) {
    if (!id) return;
    try {
      const res = await fetch(`/api/skills/pdf/${id}/${type}`, { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download =
        type === 'all'    ? 'careerops-complete-pack.pdf' :
        type === 'resume' ? 'tailored-resume.pdf' :
        `${type}-report.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      toast.error(e.message || 'PDF download failed');
    }
  }

  // ── Kanban helpers ──────────────────────────────────────────────────────────
  async function saveToKanban() {
    if (!id) return;
    try {
      await kanbanApi.patch(id, { kanbanColumn: 'Saved', status: 'saved' });
      toast.success('Saved to Kanban');
    } catch (e: any) { toast.error(e.normalizedMessage || 'Failed'); }
  }

  async function markApplied() {
    if (!id) return;
    try {
      await kanbanApi.patch(id, { kanbanColumn: 'Applied', status: 'applied' });
      toast.success('Marked as Applied');
      nav('/kanban');
    } catch (e: any) { toast.error(e.normalizedMessage || 'Failed'); }
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 animate-pulse pt-2">
      <div className="h-4 w-56 bg-slate-200 rounded" />
      <div className="h-52 bg-white border border-slate-200 rounded-2xl" />
      <div className="h-10 w-72 bg-white border border-slate-200 rounded-xl" />
      <div className="flex gap-6">
        <div className="w-72 h-96 bg-white border border-slate-200 rounded-2xl shrink-0" />
        <div className="flex-1 h-96 bg-white border border-slate-200 rounded-2xl" />
      </div>
    </div>
  );

  if (!job) return (
    <div className="max-w-6xl mx-auto text-center py-20">
      <h2 className="text-2xl font-bold text-slate-900">Job not found</h2>
      <Link to="/dashboard" className="text-indigo-600 font-bold hover:underline mt-4 inline-block">
        Return to Dashboard
      </Link>
    </div>
  );

  const salary =
    job.salaryMin && job.salaryMax
      ? `€${(job.salaryMin / 1000).toFixed(0)}k – €${(job.salaryMax / 1000).toFixed(0)}k`
      : job.salaryMin
      ? `€${(job.salaryMin / 1000).toFixed(0)}k+`
      : 'Negotiable';

  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview',  icon: <Layers size={15} /> },
    { id: 'ai-tools', label: 'AI Tools',  icon: <Brain size={15} />, badge: doneCount || undefined },
    { id: 'apply',    label: 'Apply',     icon: <ClipboardList size={15} /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">

      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-400 pt-2 mb-5">
        <Link to="/dashboard" className="hover:text-indigo-600 transition-colors font-medium">
          Dashboard
        </Link>
        <ChevronRight size={14} />
        <span className="text-slate-600 font-semibold truncate max-w-[200px] sm:max-w-xs">{job.title}</span>
        <span className="text-slate-300">at</span>
        <span className="text-slate-600 font-semibold truncate max-w-[120px]">{job.company}</span>
      </nav>

      {/* ── Profile completeness warning ── */}
      <ProfileCompletenessAlert />

      {/* ── Hero header ── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start gap-6">

          {/* Logo + job info */}
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="w-14 h-14 shrink-0 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400">
              <Building2 size={28} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">{job.title}</h1>
              <p className="text-base font-semibold text-slate-500 mt-0.5">{job.company}</p>

              <div className="flex items-center gap-2 flex-wrap mt-2">
                {job.sourceName && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getSourceStyle(job.sourceName)}`}>
                    <ExternalLink size={10} />{sourceLabel(job.sourceName)}
                  </span>
                )}
                {job.preMatchScore != null && job.preMatchScore > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Zap size={10} />{job.preMatchScore}/100 relevance
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-3 text-xs font-semibold">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-500">
                  <MapPin size={12} />{job.location || 'Remote'}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-500">
                  <Calendar size={12} />{timeAgo(job.postedAt || '')}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700">
                  <Euro size={12} />{salary}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
                  job.sponsorship
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-600 border-rose-200'
                }`}>
                  <ShieldCheck size={12} />
                  {job.sponsorship ? 'Sponsorship OK' : 'No Sponsorship'}
                </span>
              </div>

              {job.humanSummary && (
                <p className="mt-3 text-sm text-slate-600 italic bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 leading-relaxed">
                  "{job.humanSummary}"
                </p>
              )}
            </div>
          </div>

          {/* Match circle + quick actions */}
          <div className="flex flex-row md:flex-col items-center gap-3 shrink-0">
            {job.matchPercent != null && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col items-center">
                <MatchCircle percent={job.matchPercent} size={80} />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">AI Match</p>
              </div>
            )}
            <div className="flex md:flex-col gap-2 w-full">
              <button
                onClick={saveToKanban}
                title="Save to Kanban"
                className="w-10 h-10 md:w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all"
              >
                <Bookmark size={17} />
              </button>
              {job.sourceUrl ? (
                <a
                  href={job.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 md:flex-none h-10 px-4 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-all"
                >
                  <ExternalLink size={15} />Apply
                </a>
              ) : (
                <button
                  onClick={markApplied}
                  className="flex-1 md:flex-none h-10 px-4 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-all"
                >
                  <Send size={15} />Mark Applied
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              tab === t.id
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            {t.icon}
            {t.label}
            {t.badge ? (
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-indigo-600 text-white text-[10px] font-black">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Tab panels ── */}
      <AnimatePresence mode="wait">

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-6"
          >
            {/* Skills gap */}
            {(job.matchedSkills?.length || job.unmatchedSkills?.length) ? (
              <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-5 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />Skills Gap Analysis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Strong Matches</p>
                    <div className="flex flex-wrap gap-2">
                      {(job.matchedSkills || []).map(s => (
                        <span key={s} className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 size={10} />{s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Potential Gaps</p>
                    <div className="flex flex-wrap gap-2">
                      {(job.unmatchedSkills || []).map(s => (
                        <span key={s} className="px-3 py-1 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200 flex items-center gap-1">
                          <AlertCircle size={10} />{s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {/* Job description */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">About the Role</h3>
                {job.sourceUrl && (
                  <a
                    href={job.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:underline"
                  >
                    View Original <ExternalLink size={11} />
                  </a>
                )}
              </div>
              <div className="text-slate-600 leading-relaxed whitespace-pre-wrap text-sm">
                {job.description || 'No description available.'}
              </div>
            </section>

            {/* CV tips */}
            {job.cvImprovementTips && job.cvImprovementTips.length > 0 && (
              <section className="bg-white border border-slate-200 border-l-4 border-l-indigo-500 rounded-2xl p-6 md:p-8 shadow-sm">
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-5">CV Optimisation Tips</h3>
                <div className="space-y-3">
                  {job.cvImprovementTips.map((tip, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                      <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                        {i + 1}
                      </div>
                      <p className="text-sm font-medium text-slate-700 leading-snug">{tip}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* CTA to AI Tools */}
            {!anySkillDone && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-indigo-900">Run AI analysis on this job</p>
                  <p className="text-sm text-indigo-600 mt-0.5">
                    9 career intelligence tools available — evaluate your fit, tailor your CV, research the company and more.
                  </p>
                </div>
                <button
                  onClick={() => setTab('ai-tools')}
                  className="shrink-0 h-10 px-5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                  <Sparkles size={15} />Open AI Tools
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ── AI TOOLS ── */}
        {tab === 'ai-tools' && (
          <motion.div
            key="ai-tools"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col lg:flex-row gap-6 items-start"
          >
            {/* ── Sticky left rail ── */}
            <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-indigo-600" size={18} />
                  <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Intelligence Kit</h3>
                </div>

                <RunAllSkillsButton
                  userJobId={id!}
                  onComplete={() => toast.success('All 9 skills completed! Results ready below.')}
                />

                <div className="flex flex-col gap-2">
                  {ALL_SKILLS.map(({ name, label }) => (
                    <SkillBtn
                      key={name}
                      label={label}
                      status={skillHooks[name].state.status}
                      hasResult={!!skillHooks[name].state.result}
                      onClick={() => skillHooks[name].run()}
                      onOpen={() => setOpenSkill(name)}
                    />
                  ))}
                </div>

                {anySkillDone && (
                  <div className="border-t border-slate-100 pt-4 space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Download Reports</p>
                    <button
                      onClick={() => downloadPdf('all')}
                      className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 text-xs font-bold transition-all"
                    >
                      <FileDown size={13} />Complete Career Pack (PDF)
                    </button>
                    <button
                      onClick={() => downloadPdf('resume')}
                      className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-slate-200 text-slate-500 bg-white hover:border-indigo-300 hover:text-indigo-600 text-xs font-bold transition-all"
                    >
                      <FileDown size={13} />Tailored Resume (PDF)
                    </button>
                  </div>
                )}
              </div>
            </aside>

            {/* ── Results area ── */}
            <div className="flex-1 min-w-0 space-y-6">
              {ALL_SKILLS.filter(s => skillHooks[s.name].state.status === 'done').map(({ name, label }) => (
                <SkillPanel
                  key={name}
                  skillName={name}
                  label={label}
                  result={skillHooks[name].state.result}
                  userJobId={id!}
                  onDownloadPdf={() => downloadPdf(name)}
                />
              ))}

              {!anySkillDone && (
                <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
                  <div className="w-14 h-14 mx-auto mb-4 bg-indigo-50 rounded-2xl flex items-center justify-center">
                    <Brain size={28} className="text-indigo-300" />
                  </div>
                  <p className="font-semibold text-slate-700">No results yet</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Run any skill from the panel on the left to see AI-generated results here.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── APPLY ── */}
        {tab === 'apply' && (
          <motion.div
            key="apply"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="max-w-2xl space-y-6"
          >
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Apply for This Role</h3>
              {job.sourceUrl ? (
                <>
                  <p className="text-sm text-slate-500">
                    This job was sourced from <strong>{sourceLabel(job.sourceName)}</strong>. Click below to open the original posting and submit your application.
                  </p>
                  <a
                    href={job.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="w-full h-12 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-sm"
                  >
                    <ExternalLink size={16} />Apply on {sourceLabel(job.sourceName)}
                  </a>
                  <button
                    onClick={markApplied}
                    className="w-full h-10 flex items-center justify-center gap-2 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:border-indigo-300 hover:text-indigo-600 bg-white transition-all"
                  >
                    <Send size={14} />I Applied — Move to Kanban
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-500">Mark this job as applied and track it on your Kanban board.</p>
                  <button
                    onClick={markApplied}
                    className="w-full h-12 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-sm"
                  >
                    <Send size={16} />Mark as Applied
                  </button>
                </>
              )}
            </section>

            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Track on Kanban</h3>
              <p className="text-sm text-slate-500">Save this job to your pipeline board to track progress from Saved → Applied → Interview → Offer.</p>
              <button
                onClick={saveToKanban}
                className="h-10 px-5 flex items-center gap-2 border border-slate-200 rounded-xl font-semibold text-sm text-slate-600 hover:border-indigo-300 hover:text-indigo-600 bg-white transition-all"
              >
                <Bookmark size={15} />Save to Board
              </button>
            </section>

            {!anySkillDone && (
              <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                <p className="font-bold text-amber-900 text-sm">Before you apply</p>
                <p className="text-sm text-amber-700 mt-1 mb-3">
                  Run <strong>Tailor My CV</strong> and <strong>Full Evaluation</strong> from the AI Tools tab to maximise your chances.
                </p>
                <button
                  onClick={() => setTab('ai-tools')}
                  className="h-9 px-4 bg-amber-600 text-white rounded-xl font-bold text-xs hover:bg-amber-700 transition-all flex items-center gap-1.5"
                >
                  <Brain size={13} />Open AI Tools
                </button>
              </section>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── Slide-over: individual skill detail ── */}
      {openSkill && (
        <SkillPanel
          skillName={openSkill}
          label={ALL_SKILLS.find(s => s.name === openSkill)?.label ?? ''}
          result={skillHooks[openSkill].state.result}
          userJobId={id!}
          slideOver
          open
          onClose={() => setOpenSkill(null)}
          onDownloadPdf={() => downloadPdf(openSkill)}
        />
      )}

      {/* ── Question modal ── */}
      {pendingConv && (
        <SkillQuestionModal
          open
          skillLabel={pendingConv.label}
          question={pendingConv.hook.state.question!}
          onAnswer={answer => pendingConv.hook.reply(answer)}
          onClose={() => pendingConv.hook.reset()}
        />
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  if (!iso) return 'Recent';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}
