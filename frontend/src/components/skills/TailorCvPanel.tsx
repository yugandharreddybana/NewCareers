import { useState } from 'react';
import { FileDown, Eye, GitCompare } from 'lucide-react';

interface FlaggedPhrase {
  phrase: string;
  context?: string;
  suggestedRewrite?: string;
}

interface TailorCvResult {
  summary?: string;
  keywordsAdded?: string[];
  sections?: Array<{ name: string; original?: string; rewritten?: string; rationale?: string }>;
  warnings?: string[];
  atsScore?: number;
  humanScore?: number;
  flaggedPhrases?: FlaggedPhrase[];
}

interface Props {
  result: unknown;
  onDownloadPdf?: () => void;
}

function CircleGauge({ score, label, color }: { score: number; label: string; color: string }) {
  const radius = 38;
  const circum = 2 * Math.PI * radius;
  const dash   = Math.min(1, score / 100) * circum;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx="46" cy="46" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="9" />
        <circle
          cx="46" cy="46" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeDasharray={`${dash} ${circum - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 46 46)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="46" y="50" textAnchor="middle" fill={color} fontSize="18" fontWeight="800">
          {score}
        </text>
      </svg>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    </div>
  );
}

export default function TailorCvPanel({ result, onDownloadPdf }: Props) {
  const data    = (result ?? {}) as TailorCvResult;
  const [activeSection, setActiveSection] = useState(0);
  const [diffView, setDiffView]           = useState(true);

  const sections  = data.sections ?? [];
  const flagged   = data.flaggedPhrases ?? [];
  const atsScore  = data.atsScore  ?? null;
  const humanScore = data.humanScore ?? null;
  const keywords  = data.keywordsAdded ?? [];

  return (
    <div className="space-y-5">

      {/* Score meters */}
      {(atsScore != null || humanScore != null) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">CV Quality Scores</p>
          <div className="flex gap-8 justify-center">
            {atsScore != null && (
              <CircleGauge score={atsScore} label="ATS Match" color="#6366F1" />
            )}
            {humanScore != null && (
              <CircleGauge
                score={humanScore}
                label="Human Score"
                color={humanScore >= 70 ? '#10B981' : humanScore >= 45 ? '#F59E0B' : '#EF4444'}
              />
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {atsScore != null && (
              <p className="text-xs text-slate-500 text-center">
                ATS: {atsScore >= 70 ? '✅ Good keyword coverage' : atsScore >= 50 ? '⚠️ Moderate match' : '🔴 Low match — add more JD keywords'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {data.summary && (
        <p className="text-sm text-slate-700 border-l-4 border-indigo-500 pl-4 leading-relaxed">
          {data.summary}
        </p>
      )}

      {/* Keywords added */}
      {keywords.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Keywords Added</p>
          <div className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <span key={k} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                ✓ {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Flagged AI phrases */}
      {flagged.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-black text-rose-500 uppercase tracking-widest mb-3">AI Phrases to Rewrite</p>
          <div className="space-y-3">
            {flagged.map((fp, i) => (
              <div key={i} className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                <p className="text-xs font-bold text-rose-700 mb-1">
                  <span className="line-through">"{fp.phrase}"</span>
                </p>
                {fp.context && (
                  <p className="text-xs text-rose-600 italic mb-1">...{fp.context}...</p>
                )}
                {fp.suggestedRewrite && (
                  <p className="text-xs text-emerald-700 font-semibold">↳ Try: {fp.suggestedRewrite}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section diff view */}
      {sections.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">CV Sections</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDiffView(!diffView)}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 text-xs font-semibold transition-all"
              >
                {diffView ? <Eye size={11} /> : <GitCompare size={11} />}
                {diffView ? 'Single View' : 'Diff View'}
              </button>
              {onDownloadPdf && (
                <button
                  onClick={onDownloadPdf}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-all"
                >
                  <FileDown size={11} />PDF
                </button>
              )}
            </div>
          </div>

          {/* Section tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4">
            {sections.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveSection(i)}
                className={`shrink-0 px-3 h-7 rounded-lg text-xs font-semibold transition-all border ${
                  i === activeSection
                    ? 'bg-indigo-600 text-white border-transparent'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          {sections[activeSection] && (
            diffView ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Original</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap text-slate-600">
                    {sections[activeSection].original || '(empty)'}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">Tailored</p>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap text-emerald-900">
                    {sections[activeSection].rewritten || '(no changes)'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap text-indigo-900">
                {sections[activeSection].rewritten || '(no changes)'}
              </div>
            )
          )}

          {sections[activeSection]?.rationale && (
            <p className="text-xs text-slate-400 italic mt-2">→ {sections[activeSection].rationale}</p>
          )}
        </div>
      )}

      {/* Warnings */}
      {data.warnings && data.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-2">Warnings</p>
          {data.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-800">⚠ {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}
