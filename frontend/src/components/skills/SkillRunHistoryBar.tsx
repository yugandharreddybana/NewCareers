import { useMemo } from 'react';
import { History } from 'lucide-react';

export interface SkillRunHistoryEntry {
  id: string;
  createdAt: string;
  output: Record<string, unknown>;
}

interface Props {
  runs: SkillRunHistoryEntry[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

function formatLabel(iso: string, runNumber: number, isLatest: boolean): string {
  const d = new Date(iso);
  const when = Number.isNaN(d.getTime())
    ? 'Saved run'
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (isLatest) return `Latest · ${when}`;
  return `Run ${runNumber} · ${when}`;
}

export default function SkillRunHistoryBar({ runs, selectedIndex, onSelect }: Props) {
  const ordered = useMemo(() => runs, [runs]);

  if (ordered.length < 2) return null;

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/80">
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
        <History size={12} />
        Version history ({ordered.length})
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ordered.map((run, i) => (
          <button
            key={run.id}
            type="button"
            onClick={() => onSelect(i)}
            className={`shrink-0 px-2.5 h-7 rounded-lg text-xs font-semibold border transition-all ${
              i === selectedIndex
                ? 'bg-indigo-600 text-white border-transparent'
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
            }`}
          >
            {formatLabel(run.createdAt, ordered.length - i, i === 0)}
          </button>
        ))}
      </div>
      {selectedIndex > 0 && selectedIndex < ordered.length && (
        <p className="text-xs text-slate-500">
          Comparing selected run to the latest. Re-run the skill to add a new version on top.
        </p>
      )}
    </div>
  );
}
