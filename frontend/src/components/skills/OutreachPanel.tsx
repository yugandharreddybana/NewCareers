import { useState } from 'react';
import SkillPanel from './SkillPanel';
import toast from 'react-hot-toast';

interface Props { data: any; open: boolean; onClose: () => void; }

export default function OutreachPanel({ data, open, onClose }: Props) {
  const [msg, setMsg] = useState<string | null>(null);

  // init editable text from data on first open
  if (data?.body && msg === null) setTimeout(() => setMsg(data.body), 0);
  const text = msg ?? data?.body ?? '';

  if (!data) return null;
  return (
    <SkillPanel title="Draft Outreach" open={open} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-2 items-center">
          <span className="chip-slate capitalize">{data.channel || 'linkedin'}</span>
          <span className="chip-slate capitalize">{data.tone || 'professional'}</span>
          {data.wordCount > 0 && <span className="text-xs text-slate-400">{data.wordCount} words</span>}
        </div>

        {data.subject && (
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Subject</div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">{data.subject}</div>
          </div>
        )}

        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Message (editable)</div>
          <textarea
            className="input min-h-[180px] resize-y text-sm leading-relaxed"
            value={text}
            onChange={e => setMsg(e.target.value)}
          />
        </div>

        <button
          className="btn btn-primary w-full"
          onClick={() => { navigator.clipboard.writeText(text); toast.success('Copied to clipboard'); }}>
          Copy to clipboard
        </button>

        {data.alternatives?.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Alternatives</div>
            <div className="space-y-2">
              {data.alternatives.map((a: string, i: number) => (
                <div key={i} className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs text-slate-700">
                  {a}
                  <button className="ml-2 text-accent-500 hover:underline" onClick={() => setMsg(a)}>Use this</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SkillPanel>
  );
}
