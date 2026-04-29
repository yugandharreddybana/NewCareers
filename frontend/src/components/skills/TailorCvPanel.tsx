import { useState } from 'react';
import SkillPanel from './SkillPanel';

interface Props { data: any; open: boolean; onClose: () => void; }

export default function TailorCvPanel({ data, open, onClose }: Props) {
  const [active, setActive] = useState(0);
  if (!data) return null;
  const sections: any[] = data.sections || [];

  return (
    <SkillPanel title="Tailor My CV" open={open} onClose={onClose}>
      <div className="space-y-4">
        {data.summary && (
          <p className="text-slate-700 border-l-4 border-accent-500 pl-3 leading-relaxed">{data.summary}</p>
        )}

        {data.keywordsAdded?.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Keywords Added</div>
            <div className="flex flex-wrap gap-1.5">
              {data.keywordsAdded.map((k: string) => (
                <span key={k} className="chip-green">{k}</span>
              ))}
            </div>
          </div>
        )}

        {sections.length > 0 && (
          <>
            {/* Section tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {sections.map((s: any, i: number) => (
                <button key={i}
                  className={`btn text-xs whitespace-nowrap ${i === active ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActive(i)}>
                  {s.name}
                </button>
              ))}
            </div>

            {/* Diff view */}
            {sections[active] && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Your current CV</div>
                  <div className="bg-slate-50 rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap text-slate-700 border border-slate-200">
                    {sections[active].original || '(empty)'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-emerald-600 mb-1.5 uppercase tracking-wider">Recommended changes</div>
                  <div className="bg-emerald-50 rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap text-emerald-900 border border-emerald-200">
                    {sections[active].rewritten || '(no changes)'}
                  </div>
                </div>
              </div>
            )}

            {sections[active]?.rationale && (
              <div className="text-xs text-slate-500 italic">
                Why: {sections[active].rationale}
              </div>
            )}
          </>
        )}

        {data.warnings?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            {data.warnings.map((w: string, i: number) => <div key={i}>⚠ {w}</div>)}
          </div>
        )}
      </div>
    </SkillPanel>
  );
}
