import SkillPanel from './SkillPanel';
import { useNavigate } from 'react-router-dom';

interface Props { data: any; open: boolean; onClose: () => void; jobIds: string[]; }

export default function ComparePanel({ data, open, onClose, jobIds }: Props) {
  const nav = useNavigate();
  if (!data) return null;
  const rows: any[] = data.rows || [];
  const colCount = rows[0]?.values?.length || jobIds.length;

  return (
    <SkillPanel title="Job Comparison" open={open} onClose={onClose}>
      <div className="space-y-4">
        {data.rationale && (
          <p className="text-slate-700 border-l-4 border-accent-500 pl-3 leading-relaxed">{data.rationale}</p>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider pb-2 pr-4 w-32">Criteria</th>
                {Array.from({ length: colCount }).map((_, i) => (
                  <th key={i} className={`text-center text-xs font-semibold pb-2 px-3 ${i === data.winnerIndex ? 'text-accent-500' : 'text-slate-400'} uppercase tracking-wider`}>
                    {i === data.winnerIndex ? '⭐ Job ' : 'Job '}{i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any, ri: number) => (
                <tr key={ri} className="border-t border-slate-100">
                  <td className="py-2.5 pr-4 font-medium text-ink-900">{row.label}</td>
                  {(row.values || []).map((val: string, ci: number) => (
                    <td key={ci} className={`py-2.5 px-3 text-center align-top text-slate-700
                      ${ci === data.winnerIndex ? 'bg-emerald-50 font-medium text-emerald-800' : ''}`}>
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {typeof data.winnerIndex === 'number' && jobIds[data.winnerIndex] && (
          <button
            className="btn btn-accent w-full"
            onClick={() => { nav(`/jobs/${jobIds[data.winnerIndex]}`); onClose(); }}>
            Pick this one →
          </button>
        )}
      </div>
    </SkillPanel>
  );
}
