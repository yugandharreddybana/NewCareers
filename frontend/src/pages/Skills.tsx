import React, { useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { AppShell } from '@/components/layout/AppShell';
import { SkillPanel } from '@/components/skills/SkillPanel';
import { SkillButton } from '@/components/skills/SkillButton';
import { SkillQuestionModal } from '@/components/skills/SkillQuestionModal';

const SKILL_LIST = [
  { id: 'tailor_cv',           label: 'Tailor CV',             icon: '📄', description: 'Rewrite your CV for a specific job description' },
  { id: 'cover_letter',        label: 'Cover Letter',          icon: '✉️', description: 'Generate a tailored cover letter in seconds' },
  { id: 'prep_interview',      label: 'Interview Prep',        icon: '🎤', description: 'Generate likely interview questions for a role' },
  { id: 'evaluation',          label: 'Job Evaluation',        icon: '⚖️', description: 'Evaluate if a job is genuinely a good fit' },
  { id: 'culture_fit',         label: 'Culture Fit',           icon: '🏢', description: 'Analyse company culture against your values' },
  { id: 'salary_negotiation',  label: 'Salary Negotiation',    icon: '💰', description: 'Get negotiation scripts and benchmarks' },
  { id: 'linkedin_optimize',   label: 'LinkedIn Optimize',     icon: '🔗', description: 'Optimise your LinkedIn headline and summary' },
  { id: 'outreach',            label: 'Outreach Message',      icon: '📨', description: 'Draft a cold outreach to a recruiter or hiring manager' },
  { id: 'apply_assistant',     label: 'Apply Assistant',       icon: '🚀', description: 'Answer application form questions with AI' },
  { id: 'compare',             label: 'Compare Jobs',          icon: '📊', description: 'Side-by-side comparison of two job offers' },
  { id: 'research',            label: 'Company Research',      icon: '🔍', description: 'Deep-dive research on any company' },
  { id: 'triage',              label: 'Job Triage',            icon: '🗂️', description: 'Quickly score and filter a batch of jobs' },
  { id: 'skills_gap',          label: 'Skills Gap Plan',       icon: '📈', description: 'Identify skill gaps and build a learning plan' },
];

const Skills: React.FC = () => {
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [modalSkill, setModalSkill] = useState<string | null>(null);

  const active = SKILL_LIST.find(s => s.id === activeSkill);

  return (
    <>
      <PageMeta title="AI Skills — CareerOps" />
      <AppShell>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">AI Skills</h1>
            <p className="text-sm text-gray-500 mt-1">Select a skill to run it for any job or context.</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Skill grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3 lg:w-2/3">
              {SKILL_LIST.map((skill) => (
                <SkillButton
                  key={skill.id}
                  skillId={skill.id}
                  label={skill.label}
                  icon={skill.icon}
                  description={skill.description}
                  active={activeSkill === skill.id}
                  onClick={() => setActiveSkill(activeSkill === skill.id ? null : skill.id)}
                  onQuickRun={() => setModalSkill(skill.id)}
                />
              ))}
            </div>

            {/* Skill panel */}
            <div className="lg:w-1/3">
              {active ? (
                <SkillPanel
                  skillId={active.id}
                  label={active.label}
                  icon={active.icon}
                  onClose={() => setActiveSkill(null)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm">
                  <span className="text-3xl mb-2">🧠</span>
                  Select a skill to get started
                </div>
              )}
            </div>
          </div>
        </div>

        {modalSkill && (
          <SkillQuestionModal
            skillId={modalSkill}
            onClose={() => setModalSkill(null)}
          />
        )}
      </AppShell>
    </>
  );
};

export default Skills;
