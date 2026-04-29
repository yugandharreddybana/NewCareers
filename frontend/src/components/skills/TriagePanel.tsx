import SkillPanel from './SkillPanel';
import { useNavigate } from 'react-router-dom';

interface Props { data: any; open: boolean; onClose: () => void; }

const VERDICT_COLORS: Record<string, string> = {
  'Apply immediately':                     'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Worth applying, close skills gap first':'text-amber-700 bg-amber-50 border-amber-200',
  'Stretch role, apply anyway':            'text-blue-700 bg-blue-50 border-blue-200',
  'Skip':                                  'text-rose-700 bg-rose-50 border-rose-200',
};

function verdictColor(v: string): string {
  for (const [k, cls] of Object.entries(VERDICT_COLORS)) {
    if (v.toLowerCase().includes(k.toLowerCase().slice(0, 10))) return cls;
  }
  return 'text-slate-700 bg-slate-50 border-slate-200';
}

export default function TriagePanel({ data, open, onClose }: Props) {
  const nav = useNavigate();
  if (!data) return null;
  const ranked: any[] = data.ranked || [];

  return (
    <SkillPanel title="Pipeline Triage" open={open} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-500">Gemini re-ranked your full pipeline. Click any row to view the job.</p>
        {ranked.length === 0 && <p className="text-slate-400 text-sm">No jobs in pipeline yet.</p>}
        {ranked.map((item: any, i: number) => (
          <div
            key={item.userJobId || i}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:shadow-sm transition-shadow ${verdictColor(item.verdict || '')}`}
            onClick={() => { if (item.userJobId) { nav(`/jobs/${item.userJobId}`); onClose(); } }}>
            <span className="font-bold text-lg w-6 shrink-0">#{item.rank ?? i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{item.title || item.userJobId}</div>
              <div className="text-xs mt-0.5 opacity-75">{item.verdict}</div>
            </div>
            <span className="text-lg shrink-0">→</span>
          </div>
        ))}
      </div>
    </SkillPanel>
  );
}
