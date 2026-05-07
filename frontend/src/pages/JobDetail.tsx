import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';
import { AppShell } from '@/components/layout/AppShell';
import { SkillButton, SkillPanel, RunAllSkillsButton, ProfileCompletenessAlert, SkillQuestionModal } from '@/components/skills';
import { kanbanApi, jobsApi } from '@/services/api';
import type { JobDetail as JobDetailType, KanbanColumn } from '@/types';
import { KANBAN_COLUMNS } from '@/types';
import toast from 'react-hot-toast';

const SKILLS = [
  { id: 'tailor_cv',          label: 'Tailor CV',          icon: '📄' },
  { id: 'cover_letter',       label: 'Cover Letter',       icon: '✉️' },
  { id: 'prep_interview',     label: 'Interview Prep',     icon: '🎤' },
  { id: 'evaluation',         label: 'Job Evaluation',     icon: '⚖️' },
  { id: 'culture_fit',        label: 'Culture Fit',        icon: '🏢' },
  { id: 'salary_negotiation', label: 'Salary',             icon: '💰' },
  { id: 'linkedin_optimize',  label: 'LinkedIn',           icon: '🔗' },
  { id: 'outreach',           label: 'Outreach',           icon: '📨' },
  { id: 'apply_assistant',    label: 'Apply Help',         icon: '🚀' },
];

type Tab = 'overview' | 'ai-tools' | 'apply';

const JobDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  // const navigate = useNavigate();

  const [job, setJob] = useState<JobDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [modalSkill, setModalSkill] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!id) return;
    jobsApi.detail(id)
      .then(setJob)
      .catch(() => toast.error('Failed to load job.'))
      .finally(() => setLoading(false));
  }, [id]);

  const moveToColumn = async (col: KanbanColumn) => {
    if (!job) return;
    setMoving(true);
    try {
      await kanbanApi.patch(job.userJobId, { kanbanColumn: col });
      setJob(prev => prev ? { ...prev, kanbanColumn: col } : prev);
      toast.success(`Moved to ${col}`);
    } catch {
      toast.error('Failed to update status.');
    } finally {
      setMoving(false);
    }
  };

  const active = SKILLS.find(s => s.id === activeSkill);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">
          Loading job…
        </div>
      </AppShell>
    );
  }

  if (!job) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-gray-500">
          <span className="text-4xl">🔍</span>
          <p className="text-sm">Job not found.</p>
          <Link to="/dashboard" className="text-emerald-600 underline text-sm">Back to Dashboard</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <>
      <PageMeta title={`${job.title} at ${job.company} — CareerOps`} />
      <AppShell>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

          {/* Breadcrumb */}
          <nav className="text-xs text-gray-400 mb-4 flex items-center gap-1.5">
            <Link to="/dashboard" className="hover:text-emerald-600">Dashboard</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium truncate">{job.title}</span>
          </nav>

          {/* Header */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5 flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center text-lg font-bold text-emerald-700 flex-shrink-0">
              {job.company?.[0] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-gray-900">{job.title}</h1>
              <p className="text-sm text-gray-600 mt-0.5">{job.company} · {job.location}</p>
              {job.salaryMin && (
                <p className="text-xs text-gray-400 mt-1">
                  {job.currency ?? '£'}{job.salaryMin.toLocaleString()} – {job.currency ?? '£'}{job.salaryMax?.toLocaleString()}
                </p>
              )}
            </div>

            {/* Match badge */}
            {job.matchPercent !== undefined && (
              <div className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold ${
                job.matchPercent >= 75 ? 'bg-emerald-100 text-emerald-700' :
                job.matchPercent >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
              }`}>
                {job.matchPercent}% match
              </div>
            )}

            {/* Status picker */}
            <div className="flex-shrink-0">
              <select
                value={job.kanbanColumn}
                disabled={moving}
                onChange={e => moveToColumn(e.target.value as KanbanColumn)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white disabled:opacity-60"
              >
                {KANBAN_COLUMNS.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Profile completeness alert */}
          <ProfileCompletenessAlert userJobId={job.userJobId} />

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6 gap-1">
            {(['overview', 'ai-tools', 'apply'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  tab === t
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'ai-tools' ? 'AI Tools' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab: Overview */}
          {tab === 'overview' && (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 min-w-0">
                {job.humanSummary && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">AI Summary</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{job.humanSummary}</p>
                  </div>
                )}
                {job.description && (
                  <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                    {job.description}
                  </div>
                )}
                {!job.description && !job.humanSummary && (
                  <p className="text-sm text-gray-400">No description available.</p>
                )}
              </div>

              {/* Skills snapshot */}
              <div className="lg:w-56 flex-shrink-0">
                {(job.matchedSkills?.length ?? 0) > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">✅ Matched Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {job.matchedSkills!.map(s => (
                        <span key={s} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(job.unmatchedSkills?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">❌ Gaps</p>
                    <div className="flex flex-wrap gap-1.5">
                      {job.unmatchedSkills!.map(s => (
                        <span key={s} className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {job.sourceUrl && (
                  <a
                    href={job.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 block w-full text-center py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    View Original Posting →
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Tab: AI Tools */}
          {tab === 'ai-tools' && (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="lg:w-2/3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">Select a skill to run it for this job.</p>
                  <RunAllSkillsButton userJobId={job.userJobId} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SKILLS.map(skill => (
                    <SkillButton
                      key={skill.id}
                      skillId={skill.id}
                      label={skill.label}
                      icon={skill.icon}
                      active={activeSkill === skill.id}
                      onClick={() => setActiveSkill(activeSkill === skill.id ? null : skill.id)}
                      onQuickRun={() => setModalSkill(skill.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="lg:w-1/3">
                {active ? (
                  <SkillPanel
                    skillId={active.id}
                    label={active.label}
                    icon={active.icon}
                    userJobId={job.userJobId}
                    onClose={() => setActiveSkill(null)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-52 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm">
                    <span className="text-3xl mb-2">🧠</span>
                    Select a skill above
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: Apply */}
          {tab === 'apply' && (
            <div className="max-w-lg">
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-base font-semibold text-gray-900">Ready to Apply?</h2>
                <p className="text-sm text-gray-500">
                  Current status: <span className="font-medium text-gray-700">{job.kanbanColumn}</span>
                </p>

                <div className="space-y-2">
                  {job.sourceUrl && (
                    <a
                      href={job.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between w-full px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      <span>Apply on Company Site</span>
                      <span>↗️</span>
                    </a>
                  )}
                  <button
                    onClick={() => moveToColumn('Applied')}
                    disabled={moving || job.kanbanColumn === 'Applied'}
                    className="w-full px-4 py-3 border border-emerald-500 text-emerald-600 hover:bg-emerald-50 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {job.kanbanColumn === 'Applied' ? '✅ Marked as Applied' : 'Mark as Applied'}
                  </button>
                  <button
                    onClick={() => { setTab('ai-tools'); setActiveSkill('apply_assistant'); }}
                    className="w-full px-4 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold rounded-lg transition-colors"
                  >
                    🧠 Use Apply Assistant
                  </button>
                </div>

                {job.cvImprovementTips && job.cvImprovementTips.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">CV Tips</p>
                    <ul className="space-y-1">
                      {job.cvImprovementTips.map((tip, i) => (
                        <li key={i} className="text-sm text-gray-600 flex gap-2">
                          <span className="text-emerald-500 flex-shrink-0">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </AppShell>

      {modalSkill && (
        <SkillQuestionModal
          skillId={modalSkill}
          userJobId={job.userJobId}
          onClose={() => setModalSkill(null)}
        />
      )}
    </>
  );
};

export default JobDetail;
