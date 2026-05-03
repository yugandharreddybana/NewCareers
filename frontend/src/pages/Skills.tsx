/**
 * Task 142 — Skills Coach page.
 *
 * Lists all skill sessions grouped by job.
 * Each row shows: job title, company, skill name, state badge, run date.
 * Clicking a row opens an inline detail drawer with:
 *   - AI result text rendered as markdown-ish prose
 *   - PDF download button
 *   - Re-run button
 * Skeleton loading while fetching, EmptyState when no sessions exist.
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, ChevronDown, ChevronUp, Download, RotateCw,
  CheckCircle2, Loader2, AlertCircle, Clock, Zap,
} from 'lucide-react';
import PageShell from '@/components/ui/PageShell';
import EmptyState from '@/components/ui/EmptyState';
import { skillsApi } from '@/services/api';
import { jobsApi } from '@/services/api';
import { JobCard, SkillName } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────
type SkillRunState = 'idle' | 'loading' | 'done' | 'error';

interface SkillSession {
  userJobId: string;
  jobTitle: string;
  company: string;
  skillName: SkillName;
  state: SkillRunState;
  ranAt?: string;
  result?: string;
}

const SKILL_LABELS: Record<string, string> = {
  'evaluate': 'Full Evaluation',
  'tailor-resume': 'Tailor My CV',
  'research': 'Research Company',
  'outreach': 'Draft Outreach',
  'apply': 'Apply Assistant',
  'prep-interview': 'Prep Interview',
  'compare': 'Compare Jobs',
  'triage': 'Quick Triage',
  'scan': 'CV Scan',
  'salary-negotiation': 'Salary Negotiation',
  'culture-fit': 'Culture Fit',
  'linkedin-optimize': 'LinkedIn Optimise',
  'cover-letter': 'Cover Letter',
  'skills-gap-plan': 'Skills Gap Plan',
};

const ALL_SKILLS: SkillName[] = [
  'evaluate', 'tailor-resume', 'research', 'outreach', 'apply', 'prep-interview',
  'compare', 'triage', 'scan', 'salary-negotiation', 'culture-fit',
  'linkedin-optimize', 'cover-letter', 'skills-gap-plan'
];

const STATE_BADGE: Record<SkillRunState, { label: string; className: string; icon: React.ReactNode }> = {
  idle: { label: 'Not run', className: 'bg-slate-100 text-slate-500', icon: <Clock size={11} /> },
  loading: { label: 'Running', className: 'bg-indigo-100 text-indigo-600', icon: <Loader2 size={11} className="animate-spin" /> },
  done: { label: 'Done', className: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={11} /> },
  error: { label: 'Error', className: 'bg-rose-100 text-rose-600', icon: <AlertCircle size={11} /> },
};


// ── Component ──────────────────────────────────────────────────────────────
export default function Skills() {
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [sessions, setSessions] = useState<SkillSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null); // "userJobId:skillName"
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [collapsedJobs, setCollapsedJobs] = useState<Set<string>>(new Set());

  const toggleJobCollapse = (jobId: string) => {
    setCollapsedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  // Load jobs then hydrate sessions from last-run API
  useEffect(() => {
    async function init() {
      try {
        const res = await jobsApi.list();
        const allJobs: JobCard[] = res.items || [];
        setJobs(allJobs);

        // Build session list — one entry per job×skill combination
        const built: SkillSession[] = [];
        await Promise.all(
          allJobs.slice(0, 20).flatMap((job: JobCard) =>
            ALL_SKILLS.map(async (skill: SkillName) => {
              const key = `${job.userJobId}:${skill}`;
              try {
                const run = await skillsApi.getLastRun(job.userJobId, skill);
                built.push({
                  userJobId: job.userJobId,
                  jobTitle: job.title,
                  company: job.company,
                  skillName: skill,
                  state: run?.state === 'done' ? 'done' : run?.state === 'error' ? 'error' : 'idle',
                  ranAt: run?.ranAt,
                  result: run?.data?.text || run?.data?.markdown,
                });
              } catch {
                built.push({
                  userJobId: job.userJobId,
                  jobTitle: job.title,
                  company: job.company,
                  skillName: skill,
                  state: 'idle',
                });
              }
            })
          )
        );
        setSessions(built);
      } catch (e: any) {
        toast.error(e.normalizedMessage || 'Failed to load skill sessions');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const toggleExpand = useCallback((key: string) => {
    setExpanded(prev => (prev === key ? null : key));
  }, []);

  async function runSkill(session: SkillSession) {
    const key = `${session.userJobId}:${session.skillName}`;
    setRunning(prev => new Set(prev).add(key));
    setSessions(prev => prev.map(s =>
      s.userJobId === session.userJobId && s.skillName === session.skillName
        ? { ...s, state: 'loading' }
        : s
    ));
    try {
      const res = await skillsApi.start({ skillName: session.skillName, userJobId: session.userJobId });
      const resultText = res?.data?.text || res?.data?.markdown || 'Completed.';
      setSessions(prev => prev.map(s =>
        s.userJobId === session.userJobId && s.skillName === session.skillName
          ? { ...s, state: 'done', result: resultText, ranAt: new Date().toISOString() }
          : s
      ));
      toast.success(`${SKILL_LABELS[session.skillName]} complete`);
      setExpanded(key);
    } catch (e: any) {
      setSessions(prev => prev.map(s =>
        s.userJobId === session.userJobId && s.skillName === session.skillName
          ? { ...s, state: 'error' }
          : s
      ));
      toast.error(e.normalizedMessage || 'Skill run failed');
    } finally {
      setRunning(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  }

  async function downloadPdf(session: SkillSession) {
    try {
      await skillsApi.downloadSkillPdf(session.userJobId, session.skillName);
    } catch (e: any) {
      toast.error(e.normalizedMessage || 'PDF download failed');
    }
  }

  // Group sessions by job
  const grouped = jobs.slice(0, 20).map(job => ({
    job,
    sessions: sessions.filter(s => s.userJobId === job.userJobId),
  })).filter(g => g.sessions.length > 0);

  const doneCount = sessions.filter(s => s.state === 'done').length;
  const totalCount = sessions.length;

  return (
    <PageShell
      title="Skills Coach"
      subtitle="Run AI-powered tools against your pipeline jobs"
      actions={
        totalCount > 0 ? (
          <span className="text-sm font-semibold text-slate-500">
            <span className="text-emerald-600">{doneCount}</span> / {totalCount} completed
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={<Brain size={28} className="text-slate-300" />}
          message="No jobs in your pipeline yet"
          description="Scan the market from the Dashboard to discover jobs, then come back to run AI skills against them."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ job, sessions: jobSessions }) => {
            const isJobCollapsed = collapsedJobs.has(job.userJobId);
            return (
              <div key={job.userJobId}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                {/* Job header */}
                <div
                  className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  onClick={() => toggleJobCollapse(job.userJobId)}
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <Zap size={15} className="text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{job.title}</p>
                    <p className="text-xs text-slate-400">{job.company}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">
                      {jobSessions.filter(s => s.state === 'done').length}/{jobSessions.length} done
                    </span>
                    {isJobCollapsed ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
                  </div>
                </div>

                {/* Skill rows */}
                {!isJobCollapsed && (
                  <div className="divide-y divide-slate-50">
                    {jobSessions.map(session => {
                      const key = `${session.userJobId}:${session.skillName}`;
                      const badge = STATE_BADGE[session.state];
                      const isOpen = expanded === key;
                      const isRunning = running.has(key);

                      return (
                        <div key={key}>
                          <div
                            className="flex items-center gap-4 px-5 py-3.5
                                       hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => session.state === 'done' && toggleExpand(key)}
                          >
                            {/* Skill label */}
                            <p className="flex-1 text-sm font-medium text-slate-700">
                              {SKILL_LABELS[session.skillName] ?? session.skillName}
                            </p>

                            {/* State badge */}
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full
                                             text-[10px] font-bold ${badge.className}`}>
                              {badge.icon}
                              {badge.label}
                            </span>

                            {/* Run date */}
                            {session.ranAt && (
                              <span className="text-[10px] text-slate-400 hidden sm:block">
                                {new Date(session.ranAt).toLocaleDateString()}
                              </span>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              {session.state === 'done' && (
                                <>
                                  <button
                                    onClick={e => { e.stopPropagation(); downloadPdf(session); }}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400
                                               hover:text-slate-700 transition-colors"
                                    title="Download PDF"
                                  >
                                    <Download size={13} />
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); toggleExpand(key); }}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400
                                               hover:text-slate-700 transition-colors"
                                  >
                                    {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  </button>
                                </>
                              )}
                              <button
                                onClick={e => { e.stopPropagation(); runSkill(session); }}
                                disabled={isRunning || session.state === 'loading'}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                                           text-xs font-bold bg-slate-900 text-white
                                           hover:bg-slate-700 transition-all
                                           disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isRunning
                                  ? <><Loader2 size={11} className="animate-spin" /> Running</>
                                  : <><RotateCw size={11} /> {session.state === 'done' ? 'Re-run' : 'Run'}</>
                                }
                              </button>
                            </div>
                          </div>

                          {/* Expandable result */}
                          <AnimatePresence>
                            {isOpen && session.result && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
                                  <pre className="text-xs text-slate-700 whitespace-pre-wrap
                                                  font-sans leading-relaxed max-h-96 overflow-y-auto">
                                    {session.result}
                                  </pre>
                                  <div className="flex justify-end mt-3">
                                    <button
                                      onClick={() => downloadPdf(session)}
                                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl
                                                 bg-emerald-500 text-white text-xs font-bold
                                                 hover:bg-emerald-600 transition-all"
                                    >
                                      <Download size={12} /> Download PDF
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
