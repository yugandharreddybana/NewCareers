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
  CheckCircle2, AlertCircle, Bookmark, Send
} from 'lucide-react';

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
      <Link to="/dashboard" className="text-brand-vibrant font-bold hover:underline mt-4 inline-block">Return to Dashboard</Link>
    </div>
  );

  const salary = job.salaryMin && job.salaryMax
    ? `€${(job.salaryMin/1000).toFixed(0)}k – €${(job.salaryMax/1000).toFixed(0)}k`
    : job.salaryMin ? `€${(job.salaryMin/1000).toFixed(0)}k+` : 'Negotiable';

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-brand-vibrant transition-colors group">
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        BACK TO DASHBOARD
      </Link>

      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <section className="glass-card p-8 md:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-vibrant/5 blur-3xl rounded-full -mr-32 -mt-32" />
        
        <div className="flex flex-col md:flex-row items-start justify-between gap-8 relative">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-center text-slate-400">
                <Building2 size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 leading-tight">{job.title}</h1>
                <p className="text-lg font-semibold text-slate-500">{job.company}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-500">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
                <MapPin size={16} className="text-slate-400" />
                {job.location || 'Remote'}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
                <Calendar size={16} className="text-slate-400" />
                {timeAgo(job.postedAt || '')}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-vibrant/5 text-brand-vibrant border border-brand-vibrant/10">
                <Euro size={16} />
                {salary}
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${job.sponsorship ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                <ShieldCheck size={16} />
                {job.sponsorship ? 'Sponsorship OK' : 'No Sponsorship'}
              </div>
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-center gap-4">
            {job.matchPercent != null && (
              <div className="p-4 bg-white rounded-3xl shadow-premium border border-white">
                <MatchCircle percent={job.matchPercent} size={90} />
                <p className="text-[10px] font-black text-center text-slate-400 uppercase tracking-widest mt-2">Match Score</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={saveToKanban} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-brand-vibrant hover:border-brand-vibrant/30 transition-all shadow-sm">
                <Bookmark size={20} />
              </button>
              <button onClick={markApplied} className="flex-1 px-6 h-12 flex items-center justify-center gap-2 rounded-2xl bg-brand-vibrant text-white font-bold text-sm shadow-glow hover:bg-brand-deep transition-all">
                <Send size={18} />
                Apply Now
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Intelligence Tools */}
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

          {/* Skills Analysis */}
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
                        <CheckCircle2 size={12} />
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Potential Gaps</p>
                  <div className="flex flex-wrap gap-2">
                    {(job.unmatchedSkills || []).map(s => (
                      <span key={s} className="px-3 py-1 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold border border-rose-100 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        {/* Right Column: Content */}
        <div className="lg:col-span-2 space-y-8">
          <section className="glass-card p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-sm">About the Role</h3>
              {job.sourceUrl && (
                <a href={job.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-vibrant hover:underline flex items-center gap-1">
                  Original Post
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <div className="prose prose-slate max-w-none">
               <div className="text-slate-600 leading-relaxed whitespace-pre-wrap text-sm">
                {job.description || 'No description available.'}
              </div>
            </div>
          </section>

          {/* CV Tips */}
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

      {/* Panels */}
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
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}
