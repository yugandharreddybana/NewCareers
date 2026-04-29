import SkillPanel from './SkillPanel';

interface Props { data: any; open: boolean; onClose: () => void; }

export default function EvaluationPanel({ data, open, onClose }: Props) {
  if (!data) return null;
  const s = data.sections || {};
  return (
    <SkillPanel title="Full Evaluation" open={open} onClose={onClose}>
      <div className="space-y-5">
        {/* Headline */}
        <div className="flex items-center justify-between">
          <div>
            <span className={`chip text-base font-bold px-3 py-1.5 ${badgeColor(data.matchPercent)}`}>
              {data.matchPercent ?? '—'}% match
            </span>
            {data.verdict && <span className="ml-2 text-slate-600">{data.verdict}</span>}
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Overall</div>
            <div className="font-semibold">{data.overallScore ?? '—'} / 100</div>
          </div>
        </div>

        {data.humanSummary && (
          <p className="text-slate-700 leading-relaxed border-l-4 border-ink-900 pl-3">{data.humanSummary}</p>
        )}

        {/* Skill chips */}
        {(data.matchedSkills?.length || data.unmatchedSkills?.length) && (
          <Section title="Skills">
            <div className="flex flex-wrap gap-2">
              {(data.matchedSkills || []).map((s: string) => (
                <span key={s} className="chip-green">✓ {s}</span>
              ))}
              {(data.unmatchedSkills || []).map((s: string) => (
                <span key={s} className="chip-red">✗ {s}</span>
              ))}
            </div>
          </Section>
        )}

        {/* Sections A-F */}
        {[
          ['Executive Summary',       s.executiveSummary],
          ['Background Match',        s.backgroundMatch],
          ['Positioning Strategy',    s.positioningStrategy],
          ['Compensation & Market',   s.compensationAndMarket],
          ['Tailoring Plan',          s.tailoringPlan],
          ['Interview Prep',          s.interviewPrep],
        ].filter(([,v]) => v).map(([label, text]) => (
          <Section key={label as string} title={label as string}>
            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{text as string}</p>
          </Section>
        ))}

        {/* CV tips */}
        {data.cvImprovementTips?.length > 0 && (
          <Section title="CV Improvement Tips">
            <ul className="space-y-2">
              {data.cvImprovementTips.map((t: string, i: number) => (
                <li key={i} className="flex gap-2"><span className="text-warn-500 shrink-0">→</span>{t}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </SkillPanel>
  );
}

function badgeColor(p?: number) {
  if (!p) return 'bg-slate-100 text-slate-700';
  if (p >= 80) return 'bg-emerald-100 text-emerald-800';
  if (p >= 60) return 'bg-amber-100 text-amber-800';
  return 'bg-rose-100 text-rose-800';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{title}</h3>
      {children}
    </div>
  );
}
