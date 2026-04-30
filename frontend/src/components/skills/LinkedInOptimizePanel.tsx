import { useState } from 'react';
import { Copy, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface HeadlineResult {
  current?: string;
  rewritten?: string;
  charCount?: number;
}

interface AboutResult {
  current?: string;
  rewritten?: string;
}

interface ExperienceBullet {
  role?: string;
  original?: string;
  rewritten?: string;
}

interface LinkedInOptimizeResult {
  headline?:          HeadlineResult;
  about?:             AboutResult;
  experienceBullets?: ExperienceBullet[];
  keywordsAdded?:     string[];
}

interface Props {
  result: unknown;
}

function BeforeAfterCard({
  label, current, rewritten, charCount
}: { label: string; current?: string; rewritten?: string; charCount?: number }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!rewritten) return;
    await navigator.clipboard.writeText(rewritten).catch(() => {});
    toast.success(`${label} copied!`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{label}</p>
        {charCount != null && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            charCount <= 120 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                             : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {charCount} chars
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Before</p>
          <p className="text-sm text-slate-500 leading-relaxed">{current || 'Not provided'}</p>
        </div>
        <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 relative">
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">After</p>
          <p className="text-sm text-indigo-900 leading-relaxed">{rewritten || '—'}</p>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            {copied ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LinkedInOptimizePanel({ result }: Props) {
  const data = result as LinkedInOptimizeResult;

  return (
    <div className="space-y-5">
      {data.headline && (
        <BeforeAfterCard
          label="Headline"
          current={data.headline.current}
          rewritten={data.headline.rewritten}
          charCount={data.headline.charCount ?? data.headline.rewritten?.length}
        />
      )}

      {data.about && (
        <BeforeAfterCard
          label="About Section"
          current={data.about.current}
          rewritten={data.about.rewritten}
        />
      )}

      {data.experienceBullets && data.experienceBullets.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Experience Bullet Rewrites</p>
          {data.experienceBullets.map((b, i) => (
            <BeforeAfterCard
              key={i}
              label={b.role || `Experience ${i + 1}`}
              current={b.original}
              rewritten={b.rewritten}
            />
          ))}
        </div>
      )}

      {data.keywordsAdded && data.keywordsAdded.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Keywords Added</p>
          <div className="flex flex-wrap gap-2">
            {data.keywordsAdded.map((kw) => (
              <span key={kw} className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
