import { useState } from 'react';
import { Copy, CheckCircle2 } from 'lucide-react';

interface SalaryBand { min: number; mid: number; max: number; currency?: string; }
interface SalaryNegotiationOutput {
  salaryBand: SalaryBand;
  openingAsk: number;
  targetFigure: number;
  walkAwayFloor: number;
  counterofferResponses?: string[];
  negotiationPhrases?: string[];
  marketInsights?: string;
}

interface Props { data: SalaryNegotiationOutput; }

function fmt(n: number) {
  return `€${(n / 1000).toFixed(0)}k`;
}

function CopyLine({ text }: { text: string }) {
  const [c, setC] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setC(true);
    setTimeout(() => setC(false), 2000);
  };
  return (
    <li className="flex items-start gap-2 group py-1.5 border-b border-slate-100 last:border-0">
      <span className="flex-1 text-sm text-slate-700 leading-snug">{text}</span>
      <button
        onClick={copy}
        className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded hover:bg-slate-100 transition-all"
        title="Copy"
      >
        {c ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} className="text-slate-400" />}
      </button>
    </li>
  );
}

export function SalaryNegotiationPanel({ data }: Props) {
  const band = data.salaryBand;
  const range = band.max - band.min || 1;
  const pct = (n: number) => Math.min(100, Math.max(0, Math.round(((n - band.min) / range) * 100)));

  const markers = [
    { label: 'Walk Away', value: data.walkAwayFloor, color: 'bg-rose-400', ring: 'ring-rose-200' },
    { label: 'Market Mid', value: band.mid, color: 'bg-amber-400', ring: 'ring-amber-200' },
    { label: 'Target', value: data.targetFigure, color: 'bg-emerald-500', ring: 'ring-emerald-200' },
    { label: 'Opening Ask', value: data.openingAsk, color: 'bg-indigo-500', ring: 'ring-indigo-200' },
  ];

  return (
    <div className="space-y-5">
      {/* Salary band bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-medium">
          <span>{fmt(band.min)} min</span>
          <span>{fmt(band.max)} max</span>
        </div>
        <div className="relative h-5 bg-slate-100 rounded-full">
          <div className="absolute inset-0 bg-gradient-to-r from-rose-100 via-amber-100 to-emerald-100 rounded-full" />
          {markers.map(m => (
            <div
              key={m.label}
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full ${m.color} ring-2 ring-white shadow-md z-10`}
              style={{ left: `${pct(m.value)}%` }}
              title={`${m.label}: ${fmt(m.value)}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
          {markers.map(m => (
            <div key={m.label} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${m.color}`} />
              <span className="text-slate-500">{m.label}:</span>
              <span className="font-semibold text-slate-800">{fmt(m.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Market insight */}
      {data.marketInsights && (
        <p className="text-sm text-slate-600 italic bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 leading-relaxed">
          📊 {data.marketInsights}
        </p>
      )}

      {/* Counteroffer responses */}
      {(data.counterofferResponses?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Counteroffer Responses</p>
          <ul className="bg-white border border-slate-200 rounded-xl px-4">
            {data.counterofferResponses!.map((r, i) => <CopyLine key={i} text={r} />)}
          </ul>
        </div>
      )}

      {/* Negotiation phrases */}
      {(data.negotiationPhrases?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Irish-Market Phrases</p>
          <ul className="bg-white border border-slate-200 rounded-xl px-4">
            {data.negotiationPhrases!.map((p, i) => <CopyLine key={i} text={p} />)}
          </ul>
        </div>
      )}
    </div>
  );
}
