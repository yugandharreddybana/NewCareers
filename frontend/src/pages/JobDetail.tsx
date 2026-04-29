import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { jobsApi, kanbanApi, skillsApi } from '@/services/api';
import { JobDetail as JD } from '@/types';
import MatchCircle from '@/components/ui/MatchCircle';
import SkillButton from '@/components/skills/SkillButton';
import { useSkill } from '@/components/skills/useSkill';
import EvaluationPanel    from '@/components/skills/EvaluationPanel';
import TailorCvPanel      from '@/components/skills/TailorCvPanel';
import ResearchPanel      from '@/components/skills/ResearchPanel';
import OutreachPanel      from '@/components/skills/OutreachPanel';
import ApplyAssistantPanel from '@/components/skills/ApplyAssistantPanel';
import PrepInterviewPanel  from '@/components/skills/PrepInterviewPanel';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Building2, MapPin, Calendar,
  Euro, ShieldCheck, ExternalLink, Sparkles,
  CheckCircle2, AlertCircle, Bookmark, Send, Zap
} from 'lucide-react';

// ── Source badge colour map (mirrors JobCard.tsx) ───────────────────────
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

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<JD | null>(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    if (!id) return;
    jobsApi.detail(id)
      .then(setJob)
      .catch((e: any) => toast.error(e.normalizedMessage || 'Failed to load job'))
      .finally(() => setLoading(false));
  }, [id]);

  const evalSkill    = useSkill(useCallback(() => skillsApi.evaluate(id!),      [id]));
  const tailorSkill  = useSkill(useCallback(() => skillsApi.tailorResume(id!),  [id]));
  const researchSkill= useSkill(useCallback(() => skillsApi.research(id!),      [id]));
  const outreachSkill= useSkill(useCallback(() => skillsApi.outreach(id!),      [id]));
  const applySkill   = useSkill(useCallback(() => skillsApi.apply(id!),         [id]));
  const prepSkill    = useSkill(useCallback(() => skillsApi.prepInterview(id!), [id]));

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

  if (loading) return (
    <div className="max-w-5xl mx-auto space-y-8 animate-pulse">
      <div className="h-4 w-32 bg-slate-200 rounded" />
      <div className="h-64 glass-card" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="h-96 glass-card" />
        <div className="h-96 glass-card" />
      </div>
    </div>
  );

  if (!job) return (
    <div className="max-w-5xl mx-auto text-center py-20">
      <h2 className="text-2xl font-bold text-slate-900">Job not found</h2>
      <Link to="/dashboard" className="text-brand-vibrant font-bold hover:underline mt-4 inline-block">
        Return to Dashboard
      </Link>
    </div>
  );

  const salary = job.salaryMin && job.salaryMax
    ? `€${(job.salaryMin/1000).toFixed(0)}k – €${(job.salaryMax/1000).toFixed(0)}k`
    : job.salaryMin ? `€${(job.salaryMin/1000).toFixed(0)}k+` : 'Negotiable';

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-brand-vibrant transition-colors group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        BACK TO DASHBOARD
      </Link>

      {/* ─── Hero Header ──────────────────────────────────────────────────────── */}
      <section className="glass-card p-8 md:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-vibrant/5 blur-3xl rounded-full -mr-32 -mt-32" />

        <div className="flex flex-col md:flex-row items-start justify-between gap-8 relative">
          <div className="flex-1 space-y-4">

            {/* Company + Title */}
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-center text-slate-400">
                <Building2 size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 leading-tight">{job.title}</h1>
                <p className="text-lg font-semibold text-slate-500">{job.company}</p>
              </div>
            </div>

            {/* Source badge + pre-match score */}
            <div className="flex items-center gap-2 flex-wrap">
              {job.sourceName && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  getSourceStyle(job.sourceName)
                }`}>
                  <ExternalLink size={11} />
                  {sourceLabel(job.sourceName)}
                </span>
              )}
              {job.preMatchScore != null && job.preMatchScore > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-vibrant/5 text-brand-vibrant border border-brand-vibrant/20">
                  <Zap size={11} />
                  {job.preMatchScore}/100 relevance score
                </span>
              )}
            </div>

            {/* Meta pills */}
            <div className="flex flex-wrap gap-3 text-sm font-bold text-slate-500">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
                <MapPin size={15} className="text-slate-400" />
                {job.location || 'Remote'}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
                <Calendar size={15} className="text-slate-400" />
                {timeAgo(job.postedAt || '')}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-vibrant/5 text-brand-vibrant border border-brand-vibrant/10">
                <Euro size={15} />
                {salary}
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                job.sponsorship
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  : 'bg-rose-50 text-rose-600 border-rose-100'
              }`}>
                <ShieldCheck size={15} />
                {job.sponsorship ? 'Sponsorship OK' : 'No Sponsorship'}
              </div>
            </div>

            {/* Gemini human summary */}
            {job.humanSummary && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-slate-600 leading-relaxed bg-brand-vibrant/5 border border-brand-vibrant/10 rounded-xl px-4 py-3 italic"
              >
                “{job.humanSummary}”
              </motion.p>
            )}
          </div>

          {/* Match circle + action buttons */}
          <div className="shrink-0 flex flex-col items-center gap-4">
            {job.matchPercent != null && (
              <div className="p-4 bg-white rounded-3xl shadow-premium border border-white">
                <MatchCircle percent={job.matchPercent} size={90} />
                <p className="text-[10px] font-black text-center text-slate-400 uppercase tracking-widest mt-2">
                  AI Match Score
                </p>
              </div>
            )}

            <div className="flex gap-2 w-full">
              <button
                onClick={saveToKanban}
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-brand-vibrant hover:border-brand-vibrant/30 transition-all shadow-sm"
                title="Save to Kanban"
              >
                <Bookmark size={20} />
              </button>

              {/* ✔ Direct link to original job posting — opens in new tab */}
              {job.sourceUrl ? (
                <a
                  href={job.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-5 h-12 flex items-center justify-center gap-2 rounded-2xl bg-brand-vibrant text-white font-bold text-sm shadow-glow hover:bg-brand-deep transition-all"
                >
                  <ExternalLink size={17} />
                  Apply on {sourceLabel(job.sourceName)}
                </a>
              ) : (
                <button
                  onClick={markApplied}
                  className="flex-1 px-5 h-12 flex items-center justify-center gap-2 rounded-2xl bg-brand-vibrant text-white font-bold text-sm shadow-glow hover:bg-brand-deep transition-all"
                >
                  <Send size={17} />
                  Mark Applied
                </button>
              )}
            </div>

            {/* If sourceUrl exists, show separate Mark Applied button below */}
            {job.sourceUrl && (
              <button
                onClick={markApplied}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-500 hover:text-brand-vibrant hover:border-brand-vibrant/30 text-xs font-bold transition-all shadow-sm"
              >
                <Send size={14} />
                I Applied — Move to Kanban
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Intelligence Tools + Skills */}
        <div className="lg:col-span-1 space-y-8">
          <section className="glass-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="text-brand-vibrant" size={20} />
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-sm">Intelligence Kit</h3>
            </div>
            <div className="flex flex-col gap-3">
              <SkillButton label="Full Evaluation"  state={evalSkill.state}     onClick={evalSkill.run} />
              <SkillButton label="Tailor My CV"     state={tailorSkill.state}   onClick={tailorSkill.run} />
              <SkillButton label="Research Company" state={researchSkill.state} onClick={researchSkill.run} />
              <SkillButton label="Draft Outreach"   state={outreachSkill.state} onClick={outreachSkill.run} />
              <SkillButton label="Apply Assistant"  state={applySkill.state}    onClick={applySkill.run} />
              <SkillButton label="Prep Interview"   state={prepSkill.state}     onClick={prepSkill.run} />
            </div>
          </section>

          {(job.matchedSkills?.length || job.unmatchedSkills?.length) ? (
            <section className="glass-card p-6">
              <div className="flex items-center gap-2 mb-6">
                <CheckCircle2 className="text-emerald-500" size={20} />
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-sm">Skills Gap Analysis</h3>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Strong Matches</p>
                  <div className="flex flex-wrap gap-2">
                    {(job.matchedSkills || []).map(s => (
                      <span key={s} className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100 flex items-center gap-1">
                        <CheckCircle2 size={11} /> {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Potential Gaps</p>
                  <div className="flex flex-wrap gap-2">
                    {(job.unmatchedSkills || []).map(s => (
                      <span key={s} className="px-3 py-1 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold border border-rose-100 flex items-center gap-1">
                        <AlertCircle size={11} /> {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        {/* Right Column: Description + CV Tips */}
        <div className="lg:col-span-2 space-y-8">
          <section className="glass-card p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-sm">About the Role</h3>
              {/* Source URL link — always visible at top of description */}
              {job.sourceUrl && (
                <a
                  href={job.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-vibrant hover:underline"
                >
                  View Original Posting
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <div className="text-slate-600 leading-relaxed whitespace-pre-wrap text-sm">
              {job.description || 'No description available.'}
            </div>
          </section>

          {job.cvImprovementTips && job.cvImprovementTips.length > 0 && (
            <section className="glass-card p-8 border-l-4 border-l-brand-vibrant">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-sm mb-6">CV Optimization Tips</h3>
              <div className="space-y-4">
                {job.cvImprovementTips.map((tip, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-2xl bg-brand-vibrant/5 border border-brand-vibrant/10">
                    <div className="w-6 h-6 rounded-lg bg-brand-vibrant text-white flex items-center justify-center shrink-0 font-bold text-xs">
                      {i + 1}
                    </div>
                    <p className="text-sm font-medium text-slate-700 leading-snug">{tip}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Slide-over Panels */}
      <EvaluationPanel     data={evalSkill.data}     open={evalSkill.open}     onClose={() => evalSkill.setOpen(false)} />
      <TailorCvPanel       data={tailorSkill.data}   open={tailorSkill.open}   onClose={() => tailorSkill.setOpen(false)} />
      <ResearchPanel       data={researchSkill.data} open={researchSkill.open} onClose={() => researchSkill.setOpen(false)} />
      <OutreachPanel       data={outreachSkill.data} open={outreachSkill.open} onClose={() => outreachSkill.setOpen(false)} />
      <ApplyAssistantPanel data={applySkill.data}    open={applySkill.open}    onClose={() => applySkill.setOpen(false)}
        userJobId={id!} onApplied={() => nav('/kanban')} />
      <PrepInterviewPanel  data={prepSkill.data}     open={prepSkill.open}     onClose={() => prepSkill.setOpen(false)} />
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
