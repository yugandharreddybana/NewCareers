import { useMemo } from 'react';
import { History } from 'lucide-react';
import { formatSkillTokensCompact } from '@/lib/formatSkillTokens';

export interface SkillRunHistoryEntry {
  id: string;
  createdAt: string;
  output: Record<string, unknown>;
  totalTokens?: number | null;
}

interface Props {
  runs: SkillRunHistoryEntry[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  skillName?: string;
}

function formatLabel(
  iso: string,
  runNumber: number,
  isLatest: boolean,
  totalTokens?: number | null,
): string {
  const d = new Date(iso);
  const when = Number.isNaN(d.getTime())
    ? 'Saved run'
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const tokens = formatSkillTokensCompact(totalTokens);
  const tokenSuffix = tokens ? ` · ${tokens}` : '';
  if (isLatest) return `Latest · ${when}${tokenSuffix}`;
  return `Run ${runNumber} · ${when}${tokenSuffix}`;
}

export default function SkillRunHistoryBar({ runs, selectedIndex, onSelect, skillName }: Props) {
  const ordered = useMemo(() => runs, [runs]);

  if (ordered.length < 2) return null;

  const isCoverLetter = skillName === 'cover-letter';

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
                ? 'bg-brand-500 text-white border-transparent'
                : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
            }`}
          >
            {formatLabel(run.createdAt, ordered.length - i, i === 0, run.totalTokens)}
          </button>
        ))}
      </div>
      {selectedIndex > 0 && selectedIndex < ordered.length && (
        <p className="text-xs text-slate-500">
          {isCoverLetter
            ? 'Viewing an earlier version. PDF download uses the selected version.'
            : 'Comparing selected run to the latest. Re-run the skill to add a new version on top.'}
        </p>
      )}
    </div>
  );
}