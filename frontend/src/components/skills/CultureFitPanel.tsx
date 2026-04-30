interface Dimension {
  name: string;
  score: number;
  insight?: string;
}

interface CultureFitResult {
  overallScore?: number;
  dimensions?: Dimension[];
  compatibilityParagraph?: string;
  redFlags?: string[];
  greenFlags?: string[];
}

interface Props {
  result: unknown;
}

function RadialGauge({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  const radius  = 40;
  const circum  = 2 * Math.PI * radius;
  const dash    = (clamped / 100) * circum;
  const color   = clamped >= 70 ? '#10B981' : clamped >= 45 ? '#F59E0B' : '#EF4444';

  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="10" />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash} ${circum - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="50" y="54" textAnchor="middle" className="text-2xl font-extrabold" fill={color} fontSize="20" fontWeight="800">
          {clamped}
        </text>
      </svg>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest -mt-1">Culture Fit</p>
    </div>
  );
}

export default function CultureFitPanel({ result }: Props) {
  const data = result as CultureFitResult;

  return (
    <div className="space-y-5">

      {/* Score + paragraph */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row gap-6 items-center">
        {data.overallScore != null && <RadialGauge score={data.overallScore} />}
        {data.compatibilityParagraph && (
          <p className="text-sm text-slate-700 leading-relaxed flex-1">{data.compatibilityParagraph}</p>
        )}
      </div>

      {/* Dimension bars */}
      {data.dimensions && data.dimensions.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Culture Dimensions</p>
          <div className="space-y-3">
            {data.dimensions.map((d) => {
              const score  = Math.min(100, Math.max(0, d.score));
              const color  = score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-rose-500';
              return (
                <div key={d.name}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-slate-600 capitalize">{d.name}</span>
                    <span className="text-xs font-bold text-slate-500">{score}/100</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${color}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  {d.insight && <p className="text-xs text-slate-400 mt-0.5">{d.insight}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Flags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.greenFlags && data.greenFlags.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-2">Green Flags</p>
            <ul className="space-y-1">
              {data.greenFlags.map((f, i) => (
                <li key={i} className="text-sm text-emerald-800 flex items-start gap-1.5">
                  <span className="text-emerald-500 mt-0.5">✓</span>{f}
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.redFlags && data.redFlags.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
            <p className="text-xs font-black text-rose-700 uppercase tracking-widest mb-2">Red Flags</p>
            <ul className="space-y-1">
              {data.redFlags.map((f, i) => (
                <li key={i} className="text-sm text-rose-800 flex items-start gap-1.5">
                  <span className="text-rose-500 mt-0.5">⚠</span>{f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
