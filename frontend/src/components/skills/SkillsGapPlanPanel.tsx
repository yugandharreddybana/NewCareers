import { useState } from 'react';
import { ExternalLink, Clock } from 'lucide-react';

interface GapItem {
  skill: string;
  priority?: 'high' | 'medium' | 'low';
  course?: { title?: string; platform?: string; url?: string; durationHours?: number };
  milestone30?: string;
  milestone60?: string;
  milestone90?: string;
  weeklyHours?: number;
}

interface SkillsGapPlanResult {
  gaps?: GapItem[];
  totalWeeklyHours?: number;
  priorityOrder?: string[];
  summary?: string;
}

interface Props {
  result: unknown;
}

const PRIORITY_STYLE: Record<string, string> = {
  high:   'bg-rose-50 text-rose-700 border-rose-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low:    'bg-slate-50 text-slate-600 border-slate-200',
};

export default function SkillsGapPlanPanel({ result }: Props) {
  const data   = result as SkillsGapPlanResult;
  const gaps   = data.gaps ?? [];
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setChecked(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-5">

      {/* Summary */}
      {data.summary && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <p className="text-sm text-indigo-900 leading-relaxed">{data.summary}</p>
          {data.totalWeeklyHours != null && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-indigo-600">
              <Clock size={12} />
              Est. {data.totalWeeklyHours}h/week total commitment
            </p>
          )}
        </div>
      )}

      {/* Gap cards */}
      {gaps.map((gap, gi) => (
        <div key={gi} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <h4 className="font-bold text-slate-900">{gap.skill}</h4>
            {gap.priority && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${PRIORITY_STYLE[gap.priority] ?? PRIORITY_STYLE.low}`}>
                {gap.priority} priority
              </span>
            )}
            {gap.weeklyHours != null && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200 ml-auto">
                {gap.weeklyHours}h/week
              </span>
            )}
          </div>

          {/* Course link */}
          {gap.course && (
            <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700 truncate">{gap.course.title}</p>
                <p className="text-xs text-slate-400">
                  {gap.course.platform}
                  {gap.course.durationHours ? ` · ${gap.course.durationHours}h` : ''}
                </p>
              </div>
              {gap.course.url && (
                <a
                  href={gap.course.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Open <ExternalLink size={10} />
                </a>
              )}
            </div>
          )}

          {/* 30/60/90 milestones */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Day 30', value: gap.milestone30, key: `${gi}-30` },
              { label: 'Day 60', value: gap.milestone60, key: `${gi}-60` },
              { label: 'Day 90', value: gap.milestone90, key: `${gi}-90` },
            ].map(({ label, value, key }) => value ? (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`text-left p-3 rounded-lg border transition-all ${
                  checked[key]
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
                }`}
              >
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
                  checked[key] ? 'text-emerald-600' : 'text-slate-400'
                }`}>{label}</p>
                <p className={`text-xs leading-snug ${
                  checked[key] ? 'text-emerald-800 line-through opacity-60' : 'text-slate-600'
                }`}>{value}</p>
                {checked[key] && <p className="text-[10px] text-emerald-600 font-bold mt-1">✓ Done</p>}
              </button>
            ) : null)}
          </div>
        </div>
      ))}
    </div>
  );
}
