import { useEffect, useState } from 'react';
import { FileDown, FileText } from 'lucide-react';
import { skillsApi } from '@/services/skillsApi';

interface FlaggedPhrase {
  phrase: string;
  context?: string;
  suggestedRewrite?: string;
}

interface TailorCvResult {
  summary?: string;
  tailoringPlan?: string;
  keywordsAdded?: string[];
  sections?: Array<{ name: string; original?: string; rewritten?: string; rationale?: string }>;
  warnings?: string[];
  atsScore?: number;
  humanScore?: number;
  flaggedPhrases?: FlaggedPhrase[];
  resumeHtml?: string;
}

interface Props {
  result: unknown;
  compareFrom?: unknown;
  userJobId?: string;
  onDownloadPdf?: () => void;
  onDownloadDocx?: () => void;
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

export default function TailorCvPanel({
  result,
  compareFrom,
  userJobId,
  onDownloadPdf,
  onDownloadDocx,
}: Props) {
  const data    = (result ?? {}) as TailorCvResult;
  const prior   = (compareFrom ?? {}) as TailorCvResult;
  const [activeSection, setActiveSection] = useState(0);
  const [panelView, setPanelView]         = useState<'preview' | 'sections'>('preview');
  const [previewHtml, setPreviewHtml]       = useState<string | null>(null);
  const [previewState, setPreviewState]     = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  const viewingPrior = Boolean(compareFrom);

  const rawSections = (viewingPrior ? prior.sections : data.sections) ?? data.sections ?? [];
  const sections = rawSections.filter(
    s => !/^(cv|resume|curriculum vitae)$/i.test((s.name ?? '').trim()),
  );
  const flagged   = data.flaggedPhrases ?? [];
  const atsScore  = data.atsScore  ?? null;
  const humanScore = data.humanScore ?? null;
  const keywords  = data.keywordsAdded ?? [];

  useEffect(() => {
    if (!userJobId || viewingPrior) {
      const inline = viewingPrior ? null : data.resumeHtml ?? null;
      setPreviewHtml(inline);
      setPreviewState(inline ? 'ready' : 'idle');
      return;
    }
    setPreviewState('loading');
    // Server re-renders from sections (drops legacy full-CV "CV" blocks in saved runs).
    void skillsApi
      .getResumePreview(userJobId)
      .then(p => {
        const html = (p?.html ?? data.resumeHtml ?? '').trim();
        setPreviewHtml(html || null);
        setPreviewState(html ? 'ready' : 'empty');
      })
      .catch(() => {
        const fallback = (data.resumeHtml ?? '').trim();
        setPreviewHtml(fallback || null);
        setPreviewState(fallback ? 'ready' : 'error');
      });
  }, [userJobId, viewingPrior, data.resumeHtml]);

  const downloadBar = (
    <div className="flex items-center gap-2 flex-wrap">
      {onDownloadPdf && (
        <button
          type="button"
          onClick={onDownloadPdf}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-all"
        >
          <FileDown size={12} />
          Download PDF
        </button>
      )}
      {onDownloadDocx && (
        <button
          type="button"
          onClick={onDownloadDocx}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 text-xs font-semibold transition-all"
        >
          <FileText size={12} />
          Download DOCX
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">

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
        </div>
      )}

      {viewingPrior && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Viewing a previous saved version. Select &quot;Latest&quot; in version history for the current tailored CV.
        </p>
      )}

      {data.tailoringPlan && !viewingPrior && (
        <details className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-4">
          <summary className="cursor-pointer font-label-md text-label-md text-indigo-900">
            Writer&apos;s tailoring plan (how this CV was shaped for the role)
          </summary>
          <p className="mt-3 font-body-sm text-body-sm text-indigo-950 whitespace-pre-wrap leading-relaxed">
            {data.tailoringPlan}
          </p>
        </details>
      )}

      {(data.warnings?.length ?? 0) > 0 && !viewingPrior && (
        <ul className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1 list-disc list-inside">
          {data.warnings!.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-4 border-b border-slate-100 flex-wrap">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setPanelView('preview')}
              className={`px-3 h-8 rounded-lg text-xs font-semibold border transition-all ${
                panelView === 'preview'
                  ? 'bg-brand-500 text-white border-transparent'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              Styled CV
            </button>
            <button
              type="button"
              onClick={() => setPanelView('sections')}
              className={`px-3 h-8 rounded-lg text-xs font-semibold border transition-all ${
                panelView === 'sections'
                  ? 'bg-brand-500 text-white border-transparent'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              Section changes
            </button>
          </div>
          {!viewingPrior && downloadBar}
        </div>

        {panelView === 'preview' && (
          <div className="p-4 bg-slate-100">
            {previewHtml ? (
              <iframe
                title="Tailored resume preview"
                srcDoc={previewHtml}
                className="w-full min-h-[640px] bg-white rounded-lg border border-slate-200 shadow-inner"
                sandbox="allow-same-origin"
              />
            ) : previewState === 'loading' ? (
              <p className="text-sm text-slate-500 text-center py-16">
                Loading styled preview…
              </p>
            ) : previewState === 'error' ? (
              <p className="text-sm text-amber-800 text-center py-16 px-4">
                Could not load the styled preview. Try &quot;Section changes&quot; below, or re-run Tailor my CV.
              </p>
            ) : (
              <p className="text-sm text-slate-500 text-center py-16 px-4">
                No styled preview yet. Run Tailor my CV for this job, or check Section changes if tailoring already finished.
              </p>
            )}
            <p className="text-[11px] text-slate-500 mt-3 text-center">
              Same layout as the plugin resume template — PDF and DOCX exports use this styling.
            </p>
          </div>
        )}

        {panelView === 'sections' && (
          <div className="p-5 space-y-4">
            {data.summary && (
              <p className="text-sm text-slate-700 border-l-4 border-indigo-500 pl-4 leading-relaxed">
                {data.summary}
              </p>
            )}

            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {keywords.map(k => (
                  <span
                    key={k}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200"
                  >
                    ✓ {k}
                  </span>
                ))}
              </div>
            )}

            {sections.length > 0 && (
              <>
                <div className="flex gap-1.5 overflow-x-auto pb-2">
                  {sections.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveSection(i)}
                      className={`shrink-0 px-3 h-7 rounded-lg text-xs font-semibold border ${
                        i === activeSection
                          ? 'bg-brand-500 text-white border-transparent'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>

                {sections[activeSection] && (
                  <div>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">
                      Tailored for this role
                    </p>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs whitespace-pre-wrap text-emerald-900 max-h-64 overflow-y-auto">
                      {sections[activeSection].rewritten || '(no changes)'}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {flagged.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-black text-rose-500 uppercase tracking-widest mb-3">AI Phrases to Rewrite</p>
          <div className="space-y-3">
            {flagged.map((fp, i) => (
              <div key={i} className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                <p className="text-xs font-bold text-rose-700 mb-1">
                  <span className="line-through">&quot;{fp.phrase}&quot;</span>
                </p>
                {fp.suggestedRewrite && (
                  <p className="text-xs text-emerald-700 font-semibold">↳ Try: {fp.suggestedRewrite}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.warnings && data.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          {data.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-800">⚠ {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}
