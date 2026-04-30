import { Copy } from 'lucide-react';
import toast from 'react-hot-toast';

interface SalaryBand {
  min: number;
  mid: number;
  max: number;
  currency?: string;
}

interface SalaryNegotiationResult {
  salaryBand?: SalaryBand;
  openingAsk?: number;
  targetFigure?: number;
  walkAwayFloor?: number;
  counterofferResponses?: string[];
  negotiationPhrases?: string[];
  marketInsights?: string;
}

interface Props {
  result: unknown;
}

function fmt(n?: number) {
  if (!n) return '—';
  return `€${(n / 1000).toFixed(0)}k`;
}

function SalaryBar({ band }: { band: SalaryBand }) {
  const min  = band.min  ?? 0;
  const mid  = band.mid  ?? 0;
  const max  = band.max  ?? 1;
  const range = max - min || 1;
  const midPos = ((mid - min) / range) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-bold text-slate-500">
        <span>{fmt(min)}</span>
        <span>{fmt(mid)} <span className="text-indigo-600">(mid)</span></span>
        <span>{fmt(max)}</span>
      </div>
      <div className="relative h-3 rounded-full bg-slate-100 overflow-hidden">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400 to-indigo-500" />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-indigo-600 shadow"
          style={{ left: `calc(${midPos}% - 8px)` }}
        />
      </div>
    </div>
  );
}

export default function SalaryNegotiationPanel({ result }: Props) {
  const data = result as SalaryNegotiationResult;

  const copySection = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    toast.success(`${label} copied!`);
  };

  return (
    <div className="space-y-5">

      {/* Salary band chart */}
      {data.salaryBand && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Market Salary Band — Ireland</p>
          <SalaryBar band={data.salaryBand} />
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Opening Ask', value: data.openingAsk, color: 'bg-blue-50 text-blue-700 border-blue-200' },
              { label: 'Target',      value: data.targetFigure, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
              { label: 'Walk Away',   value: data.walkAwayFloor, color: 'bg-rose-50 text-rose-700 border-rose-200' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl border px-3 py-3 text-center ${color}`}>
                <p className="text-xs font-bold opacity-70 mb-0.5">{label}</p>
                <p className="text-lg font-extrabold">{fmt(value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market insights */}
      {data.marketInsights && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-1">Market Context</p>
          <p className="text-sm text-amber-900 leading-relaxed">{data.marketInsights}</p>
        </div>
      )}

      {/* Counteroffer responses */}
      {data.counterofferResponses && data.counterofferResponses.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Counteroffer Responses</p>
          <div className="space-y-3">
            {data.counterofferResponses.map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <span className="w-5 h-5 shrink-0 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center mt-0.5">{i + 1}</span>
                <p className="text-sm text-slate-700 flex-1">{r}</p>
                <button onClick={() => copySection(r, `Response ${i + 1}`)} className="shrink-0 text-slate-300 hover:text-indigo-600 transition-colors">
                  <Copy size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Negotiation phrases */}
      {data.negotiationPhrases && data.negotiationPhrases.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Irish Workplace Phrases</p>
          <div className="flex flex-wrap gap-2">
            {data.negotiationPhrases.map((p, i) => (
              <button
                key={i}
                onClick={() => copySection(p, 'Phrase')}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-all text-left"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
