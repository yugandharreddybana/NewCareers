import SkillPanel from './SkillPanel';
import type { ResearchData } from '@/types/skills-data';

interface Props { data: ResearchData | null; open: boolean; onClose: () => void; }

export default function ResearchPanel({ data, open, onClose }: Props) {
  if (!data) return null;
  return (
    <SkillPanel title={`Research: ${data.company || 'Company'}`} open={open} onClose={onClose}>
      <div className="space-y-4">
        <Section title="What they do">
          <p className="text-slate-700 leading-relaxed">{data.whatTheyDo}</p>
        </Section>
        <Section title="Culture">
          <p className="text-slate-700 leading-relaxed">{data.culture}</p>
        </Section>
        {data.salaryBenchmark && (
          <Section title="Salary benchmarks">
            <div className="grid grid-cols-3 gap-2 text-center">
              {Object.entries(data.salaryBenchmark).map(([level, val]) => (
                <div key={level} className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                  <div className="text-xs text-slate-400 capitalize">{level}</div>
                  <div className="font-medium text-ink-900 text-sm mt-0.5">{val as string}</div>
                </div>
              ))}
            </div>
          </Section>
        )}
        {data.greenFlags && data.greenFlags.length > 0 && (
          <Section title="Green flags">
            <ul className="space-y-1">{data.greenFlags.map((f, i) => (
              <li key={i} className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span>{f}</li>
            ))}</ul>
          </Section>
        )}
        {data.redFlags && data.redFlags.length > 0 && (
          <Section title="Red flags">
            <ul className="space-y-1">{data.redFlags.map((f, i) => (
              <li key={i} className="flex gap-2"><span className="text-rose-500 shrink-0">✗</span>{f}</li>
            ))}</ul>
          </Section>
        )}
        {data.recentNews && data.recentNews.length > 0 && (
          <Section title="Recent news">
            <ul className="space-y-1">{data.recentNews.map((n, i) => (
              <li key={i} className="flex gap-2"><span className="text-slate-400 shrink-0">•</span>{n}</li>
            ))}</ul>
          </Section>
        )}
        {data.interviewStyle && (
          <Section title="Interview style">
            <p className="text-slate-700">{data.interviewStyle}</p>
          </Section>
        )}
        {data.questionsToAsk && data.questionsToAsk.length > 0 && (
          <Section title="Questions to ask them">
            <ol className="space-y-1 list-decimal list-inside">{data.questionsToAsk.map((q, i) => (
              <li key={i} className="text-slate-700">{q}</li>
            ))}</ol>
          </Section>
        )}
      </div>
    </SkillPanel>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{title}</h3>
      {children}
    </div>
  );
}
