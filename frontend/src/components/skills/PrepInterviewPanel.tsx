import { useState } from 'react';
import SkillPanel from './SkillPanel';
import type { PrepInterviewData } from '@/types/skills-data';

interface Props { data: PrepInterviewData | null; open: boolean; onClose: () => void; }

const CATEGORY_COLORS: Record<string, string> = {
  behavioural: 'bg-violet-50 text-violet-700 border-violet-200',
  technical: 'bg-blue-50 text-blue-700 border-blue-200',
  'system-design': 'bg-amber-50 text-amber-700 border-amber-200',
  'role-specific': 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function PrepInterviewPanel({ data, open, onClose }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  if (!data) return null;

  return (
    <SkillPanel title="Interview Prep Kit" open={open} onClose={onClose}>
      <div className="space-y-5">
        {/* Questions */}
        {data.likelyQuestions && data.likelyQuestions.length > 0 && (
          <Section title="Likely Questions">
            <div className="space-y-2">
              {data.likelyQuestions.map((q, i) => (
                <div key={i}
                  className="border border-slate-200 rounded-lg overflow-hidden cursor-pointer"
                  onClick={() => setExpanded(expanded === i ? null : i)}>
                  <div className="flex items-center gap-3 p-3">
                    <span className={`chip border ${q.category ? (CATEGORY_COLORS[q.category] || 'bg-slate-100 text-slate-600 border-slate-200') : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {q.category}
                    </span>
                    <span className="text-sm font-medium flex-1">{q.question}</span>
                    <span className="text-slate-400 text-xs">{expanded === i ? '▲' : '▼'}</span>
                  </div>
                  {expanded === i && q.starterAnswer && (
                    <div className="px-3 pb-3 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-2 bg-slate-50">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Starter answer</span>
                      {q.starterAnswer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Talking points */}
        {data.talkingPoints && data.talkingPoints.length > 0 && (
          <Section title="Talking Points">
            <ul className="space-y-1">
              {data.talkingPoints.map((t, i) => (
                <li key={i} className="flex gap-2 text-slate-700"><span className="text-ink-900 shrink-0">→</span>{t}</li>
              ))}
            </ul>
          </Section>
        )}

        {/* Study plan */}
        {data.studyPlan && data.studyPlan.length > 0 && (
          <Section title="Study Plan">
            <div className="space-y-2">
              {data.studyPlan.map((item, i) => (
                <div key={i} className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                  <div className="font-medium text-ink-900">{item.topic}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{item.why}</div>
                  {item.resource && (
                    <div className="text-xs text-accent-500 mt-1 font-medium">{item.resource}</div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Questions to ask */}
        {data.questionsToAskInterviewer && data.questionsToAskInterviewer.length > 0 && (
          <Section title="Questions to Ask the Interviewer">
            <ol className="space-y-1 list-decimal list-inside text-slate-700">
              {data.questionsToAskInterviewer.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </Section>
        )}

        {/* Red flags to address */}
        {data.redFlagsToAddress && data.redFlagsToAddress.length > 0 && (
          <Section title="Red Flags to Address">
            <ul className="space-y-1">
              {data.redFlagsToAddress.map((f, i) => (
                <li key={i} className="flex gap-2 text-amber-800 bg-amber-50 rounded p-2 text-xs">
                  <span className="shrink-0">⚠</span>{f}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </SkillPanel>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  );
}
