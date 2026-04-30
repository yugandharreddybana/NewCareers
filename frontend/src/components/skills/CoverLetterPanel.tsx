import React, { useState } from 'react';
import { Copy, CheckCircle2, FileText } from 'lucide-react';

interface CoverLetterOutput {
  letter: string;
  toneIndicator?: string;
  personalisationHighlights?: string[];
  wordCount?: number;
}

interface Props {
  data: CoverLetterOutput;
}

export function CoverLetterPanel({ data }: Props) {
  const [copied, setCopied] = useState(false);

  const copyLetter = () => {
    navigator.clipboard.writeText(data.letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        {data.wordCount != null && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold">
            <FileText size={11} /> {data.wordCount} words
          </span>
        )}
        {data.toneIndicator && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold">
            🎯 {data.toneIndicator}
          </span>
        )}
        <button
          onClick={copyLetter}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 text-xs font-semibold transition-all"
        >
          {copied ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy Letter'}
        </button>
      </div>

      {/* Letter body */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
        {data.letter}
      </div>

      {/* Personalisation highlights */}
      {(data.personalisationHighlights?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">What makes this personal</p>
          <ul className="space-y-1">
            {data.personalisationHighlights!.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="mt-0.5 text-emerald-500 shrink-0">✓</span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
