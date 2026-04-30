import { useState } from 'react';
import { Copy, FileDown, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface CoverLetterResult {
  letter?: string;
  toneIndicator?: string;
  personalisationHighlights?: string[];
  wordCount?: number;
}

interface Props {
  result: unknown;
  onDownloadPdf?: () => void;
}

export default function CoverLetterPanel({ result, onDownloadPdf }: Props) {
  const [copied, setCopied] = useState(false);
  const data = result as CoverLetterResult;

  if (!data?.letter) {
    return (
      <div className="p-6 text-center text-slate-400">
        <AlertCircle className="mx-auto mb-2" size={32} />
        <p className="text-sm">No cover letter generated yet.</p>
      </div>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.letter!);
      setCopied(true);
      toast.success('Cover letter copied to clipboard');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const wordCount = data.wordCount ?? data.letter.split(/\s+/).length;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {data.toneIndicator && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {data.toneIndicator}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200">
            {wordCount} words
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 text-xs font-semibold transition-all"
          >
            {copied ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          {onDownloadPdf && (
            <button
              onClick={onDownloadPdf}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-all"
            >
              <FileDown size={12} />PDF
            </button>
          )}
        </div>
      </div>

      {/* Personalisation highlights */}
      {data.personalisationHighlights && data.personalisationHighlights.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-2">What makes this letter specific</p>
          <ul className="space-y-1">
            {data.personalisationHighlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-emerald-800">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" />{h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Letter body */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">
          {data.letter}
        </pre>
      </div>
    </div>
  );
}
