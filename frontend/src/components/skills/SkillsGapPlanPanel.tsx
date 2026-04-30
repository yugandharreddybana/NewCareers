import React from 'react';
import { ExternalLink, Clock, Target } from 'lucide-react';

interface Course { title: string; platform: string; url?: string; durationHours?: number; }
interface Gap {
  skill: string;
  priority: 'high' | 'medium' | 'low';
  course?: Course;
  milestone30?: string;
  milestone60?: string;
  milestone90?: string;
  weeklyHours?: number;
}
interface SkillsGapOutput {
  gaps?: Gap[];
  totalWeeklyHours?: number;
  priorityOrder?: string[];
  summary?: string;
}

interface Props { data: SkillsGapOutput; }

const PRIORITY_STYLE: Record<string, string> = {
  high:   'bg-rose-50 text-rose-700 border-rose-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low:    'bg-slate-50 text-slate-500 border-slate-200',
};

export function SkillsGapPlanPanel({ data }: Props) {
  return (
    <div className="space-y-5">
      {/* Summary */}
      {data.summary && (
        <p className="text-sm text-slate-600 italic bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 leading-relaxed">
          🗺️ {data.summary}
        </p>
      )}

      {/* Total hours */}
      {(data.totalWeeklyHours ?? 0) > 0 && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-semibold">
          <Clock size={13} /> {data.totalWeeklyHours} hrs/week total commitment
        </div>
      )}

      {/* Gap cards */}
      {data.gaps?.map((gap, i) => (
        <div key={i} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="px-4 py-3 bg-white flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-slate-400" />
              <span className="font-semibold text-sm text-slate-900">{gap.skill}</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${PRIORITY_STYLE[gap.priority] ?? PRIORITY_STYLE.low}`}>
                {gap.priority}
              </span>
            </div>
            {gap.weeklyHours != null && (
              <span className="text-xs text-slate-400 font-medium">{gap.weeklyHours} h/wk</span>
            )}
          </div>

          {/* Course */}
          {gap.course && (
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 font-semibold">{gap.course.platform}</span>
              {gap.course.url ? (
                <a
                  href={gap.course.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline font-medium inline-flex items-center gap-1"
                >
                  {gap.course.title} <ExternalLink size={10} />
                </a>
              ) : (
                <span className="text-xs text-slate-600">{gap.course.title}</span>
              )}
              {gap.course.durationHours != null && (
                <span className="text-xs text-slate-400 ml-auto">{gap.course.durationHours}h total</span>
              )}
            </div>
          )}

          {/* 30/60/90 milestones */}
          <div className="grid grid-cols-3 divide-x divide-slate-100">
            {[
              { label: '30 days', value: gap.milestone30, accent: 'text-amber-600 bg-amber-50' },
              { label: '60 days', value: gap.milestone60, accent: 'text-indigo-600 bg-indigo-50' },
              { label: '90 days', value: gap.milestone90, accent: 'text-emerald-600 bg-emerald-50' },
            ].map(m => m.value ? (
              <div key={m.label} className="p-3">
                <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 px-1.5 py-0.5 rounded inline-block ${m.accent}`}>
                  {m.label}
                </p>
                <p className="text-xs text-slate-600 leading-snug mt-1">{m.value}</p>
              </div>
            ) : null)}
          </div>
        </div>
      ))}
    </div>
  );
}
