interface Dimension { name: string; score: number; insight?: string; }
interface CultureFitOutput {
  overallScore: number;
  dimensions?: Dimension[];
  compatibilityParagraph?: string;
  redFlags?: string[];
  greenFlags?: string[];
}

interface Props { data: CultureFitOutput; }

function scoreLabel(s: number) {
  if (s >= 80) return { text: 'Strong Fit',    cls: 'text-emerald-600' };
  if (s >= 60) return { text: 'Good Fit',      cls: 'text-emerald-500' };
  if (s >= 40) return { text: 'Moderate Fit',  cls: 'text-amber-600' };
  return          { text: 'Poor Fit',       cls: 'text-rose-600' };
}
function barColor(s: number) {
  if (s >= 75) return 'bg-emerald-500';
  if (s >= 50) return 'bg-amber-400';
  return 'bg-rose-400';
}

export function CultureFitPanel({ data }: Props) {
  const { text, cls } = scoreLabel(data.overallScore);
  return (
    <div className="space-y-5">
      {/* Overall score hero */}
      <div className="flex items-center gap-5 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="text-center shrink-0">
          <div className={`text-4xl font-black ${cls}`}>{data.overallScore}</div>
          <div className="text-xs text-slate-400 font-semibold">/100</div>
          <div className={`text-xs font-bold mt-0.5 ${cls}`}>{text}</div>
        </div>
        {data.compatibilityParagraph && (
          <p className="text-sm text-slate-600 leading-relaxed flex-1">{data.compatibilityParagraph}</p>
        )}
      </div>

      {/* Dimension bars */}
      {(data.dimensions?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dimension Breakdown</p>
          {data.dimensions!.map(d => (
            <div key={d.name}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-600 capitalize">
                  {d.name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                </span>
                <span className={`text-xs font-bold ${barColor(d.score).replace('bg-', 'text-').replace('-500', '-600').replace('-400', '-600')}`}>
                  {d.score}/100
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor(d.score)}`}
                  style={{ width: `${d.score}%` }}
                />
              </div>
              {d.insight && (
                <p className="text-[11px] text-slate-400 mt-0.5 italic leading-snug">{d.insight}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Green / Red flags */}
      {((data.greenFlags?.length ?? 0) > 0 || (data.redFlags?.length ?? 0) > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {(data.greenFlags?.length ?? 0) > 0 && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <p className="text-xs font-bold text-emerald-700 mb-2">✅ Green Flags</p>
              <ul className="space-y-1.5">
                {data.greenFlags!.map((f, i) => (
                  <li key={i} className="text-xs text-emerald-800 flex items-start gap-1.5 leading-snug">
                    <span className="mt-0.5 shrink-0">•</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(data.redFlags?.length ?? 0) > 0 && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
              <p className="text-xs font-bold text-rose-700 mb-2">⚠️ Red Flags</p>
              <ul className="space-y-1.5">
                {data.redFlags!.map((f, i) => (
                  <li key={i} className="text-xs text-rose-800 flex items-start gap-1.5 leading-snug">
                    <span className="mt-0.5 shrink-0">•</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
