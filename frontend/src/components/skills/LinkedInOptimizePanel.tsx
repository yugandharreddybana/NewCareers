import { useState } from 'react';
import { Copy, CheckCircle2 } from 'lucide-react';

interface HeadlineSection { current?: string; rewritten: string; charCount?: number; }
interface AboutSection { current?: string; rewritten: string; }
interface ExperienceBullet { role: string; original: string; rewritten: string; }
interface LinkedInOptimizeOutput {
  headline?: HeadlineSection;
  about?: AboutSection;
  experienceBullets?: ExperienceBullet[];
  keywordsAdded?: string[];
}

interface Props { data: LinkedInOptimizeOutput; }

function CopyBtn({ text }: { text: string }) {
  const [c, setC] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setC(true);
        setTimeout(() => setC(false), 2000);
      }}
      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all font-medium"
    >
      {c ? <CheckCircle2 size={11} className="text-emerald-500" /> : <Copy size={11} />}
      {c ? 'Copied' : 'Copy'}
    </button>
  );
}

interface BeforeAfterProps {
  label: string;
  before?: string | undefined;
  after: string;
  note?: string | undefined;
}

function BeforeAfter({ label, before, after, note }: BeforeAfterProps) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        {note && <span className="text-xs text-slate-400">{note}</span>}
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-100">
        <div className="p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Before</p>
          <p className="text-xs text-slate-400 leading-snug line-through decoration-slate-300">
            {before || '(empty)'}
          </p>
        </div>
        <div className="p-3 bg-emerald-50/40">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mb-1.5">After ✨</p>
          <p className="text-xs text-slate-800 leading-snug font-medium">{after}</p>
        </div>
      </div>
      <div className="px-4 py-2 border-t border-slate-100 bg-white flex justify-end">
        <CopyBtn text={after} />
      </div>
    </div>
  );
}

export function LinkedInOptimizePanel({ data }: Props) {
  return (
    <div className="space-y-4">
      {/* Headline */}
      {data.headline && (
        <BeforeAfter
          label="Headline"
          before={data.headline.current}
          after={data.headline.rewritten}
          note={data.headline.charCount != null ? `${data.headline.charCount}/120 chars` : undefined}
        />
      )}

      {/* About */}
      {data.about && (
        <BeforeAfter
          label="About Section"
          before={data.about.current}
          after={data.about.rewritten}
        />
      )}

      {/* Experience bullets */}
      {data.experienceBullets?.map((b, i) => (
        <BeforeAfter
          key={i}
          label={`Experience — ${b.role}`}
          before={b.original}
          after={b.rewritten}
        />
      ))}

      {/* Keywords added */}
      {(data.keywordsAdded?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">🔑 Keywords Added</p>
          <div className="flex flex-wrap gap-1.5">
            {data.keywordsAdded!.map((k, i) => (
              <span
                key={i}
                className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold"
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
