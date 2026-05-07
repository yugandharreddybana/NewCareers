import { useEffect, useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { jobsApi } from '@/services/api';
import { skillsApi } from '@/services/skillsApi';
import type { JobCard, SkillName } from '@/types';
import { ChevronDown, ChevronUp, Play, Download, CheckCircle2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const SKILL_LIST: Array<{ id: SkillName; label: string; icon: string; description: string }> = [
  { id: 'evaluate',            label: 'Job Evaluation',        icon: '⚖️', description: 'Evaluate if a job is genuinely a good fit' },
  { id: 'tailor-resume',       label: 'Tailor My CV',          icon: '📄', description: 'Rewrite your CV for a specific job description' },
  { id: 'cover-letter',        label: 'Cover Letter',          icon: '✉️', description: 'Generate a tailored cover letter in seconds' },
  { id: 'prep-interview',      label: 'Interview Prep',        icon: '🎤', description: 'Generate likely interview questions for a role' },
  { id: 'culture-fit',         label: 'Culture Fit',           icon: '🏢', description: 'Analyse company culture against your values' },
  { id: 'salary-negotiation',  label: 'Salary Negotiation',    icon: '💰', description: 'Get negotiation scripts and benchmarks' },
  { id: 'linkedin-optimize',   label: 'LinkedIn Optimize',     icon: '🔗', description: 'Optimise your LinkedIn headline and summary' },
  { id: 'outreach',            label: 'Outreach Message',      icon: '📨', description: 'Draft a cold outreach to a recruiter or hiring manager' },
  { id: 'apply',               label: 'Apply Assistant',       icon: '🚀', description: 'Answer application form questions with AI' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatSkillOutput(data: unknown): string {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (isRecord(data) && typeof data.text === 'string') return data.text;
  if (!isRecord(data)) return String(data);

  return Object.entries(data)
    .map(([key, value]) => {
      const formattedKey = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());

      if (Array.isArray(value)) {
        return `${formattedKey}:\n${value.map(v => `  • ${isRecord(v) ? JSON.stringify(v) : v}`).join('\n')}`;
      }
      if (isRecord(value)) {
        return `${formattedKey}:\n${Object.entries(value).map(([k, v]) => `  • ${k.replace(/_/g, ' ')}: ${v}`).join('\n')}`;
      }
      return `${formattedKey}: ${value}`;
    })
    .join('\n\n');
}

export default function Skills() {
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [runningSkills, setRunningSkills] = useState<Record<string, boolean>>({});
  const [downloadingSkills, setDownloadingSkills] = useState<Record<string, boolean>>({});
  const [skillResults, setSkillResults] = useState<Record<string, string>>({});

  useEffect(() => {
    jobsApi.list()
      .then(res => {
        setJobs(res.items || []);
        if (res.items && res.items.length > 0) {
          setExpandedJobId(res.items[0].userJobId);
        }
      })
      .catch(() => toast.error('Failed to load job roles.'))
      .finally(() => setLoading(false));
  }, []);

  const handleRunSkill = async (jobId: string, skillId: SkillName) => {
    const key = `${jobId}-${skillId}`;
    setRunningSkills(prev => ({ ...prev, [key]: true }));
    try {
      const res = await skillsApi.start({ skillName: skillId, userJobId: jobId });
      toast.success(`${skillId.replace('-', ' ')} completed successfully!`);
      if (res && res.data && typeof res.data === 'object') {
        const textValue = formatSkillOutput(res.data);
        setSkillResults(prev => ({ ...prev, [key]: textValue }));
      }
    } catch {
      toast.error(`Failed to run ${skillId.replace('-', ' ')}`);
    } finally {
      setRunningSkills(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleDownloadSkill = async (jobId: string, skillId: SkillName) => {
    const key = `${jobId}-${skillId}`;
    setDownloadingSkills(prev => ({ ...prev, [key]: true }));
    try {
      await skillsApi.downloadSkillPdf(jobId, skillId);
      toast.success(`PDF generated for ${skillId.replace('-', ' ')}`);
    } catch {
      toast.error(`Failed to download ${skillId.replace('-', ' ')}`);
    } finally {
      setDownloadingSkills(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <>
      <PageMeta title="AI Skills — CareerOps" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="text-indigo-600 w-6 h-6" />
            AI Skills Coach
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Run advanced AI skills directly within any of your job role contexts.
          </p>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-sm">Loading job roles…</span>
          </div>
        )}

        {!loading && jobs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-200 rounded-xl text-slate-400 bg-white p-6">
            <span className="text-4xl mb-2">📂</span>
            <p className="text-sm text-center">No job roles found. Create a job role first to use skills.</p>
          </div>
        )}

        {!loading && jobs.map(job => {
          const isExpanded = expandedJobId === job.userJobId;
          return (
            <div key={job.userJobId} className="mb-4 border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden transition-all duration-300">
              <button
                type="button"
                onClick={() => setExpandedJobId(isExpanded ? null : job.userJobId)}
                className="w-full flex items-center justify-between px-6 py-4 bg-slate-50/50 hover:bg-slate-50 transition-colors text-left"
              >
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {job.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {job.company} • {job.location || 'Remote'}
                  </p>
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>

              {isExpanded && (
                <div className="p-6 bg-white border-t border-slate-100">
                  <div className="flex flex-col gap-4">
                    {SKILL_LIST.map(skill => {
                      const key = `${job.userJobId}-${skill.id}`;
                      const isRunning = runningSkills[key];
                      const isDownloading = downloadingSkills[key];
                      const resultText = skillResults[key];

                      return (
                        <div key={skill.id} className="p-4 rounded-xl border border-slate-100 hover:border-indigo-100 bg-slate-50/30 hover:bg-white hover:shadow-sm transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <span className="text-2xl mt-0.5">{skill.icon}</span>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-slate-900 truncate">
                                {skill.label}
                              </h4>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                {skill.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[220px]">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRunSkill(job.userJobId, skill.id)}
                                disabled={isRunning}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition rounded-xl"
                              >
                                {isRunning ? (
                                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Play className="w-3.5 h-3.5" />
                                )}
                                {isRunning ? 'Running' : 'Run'}
                              </button>

                              <button
                                onClick={() => handleDownloadSkill(job.userJobId, skill.id)}
                                disabled={isDownloading}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition rounded-xl"
                              >
                                {isDownloading ? (
                                  <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                {isDownloading ? 'Downloading' : 'PDF'}
                              </button>
                            </div>

                            {resultText && (
                              <div className="mt-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600 max-h-48 overflow-auto">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1 font-semibold text-emerald-600">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Output Generated:</span>
                                  </div>
                                  <button
                                    onClick={() => setSkillResults(prev => {
                                      const copy = { ...prev };
                                      delete copy[key];
                                      return copy;
                                    })}
                                    className="text-slate-400 hover:text-slate-600 font-medium text-xs bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition"
                                  >
                                    Close
                                  </button>
                                </div>
                                <p className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed">
                                  {resultText}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
