import { Link } from 'react-router-dom';
import { JobCard as JC } from '@/types';
import {
  MapPin, Banknote, Calendar, ShieldCheck,
  ExternalLink, Building2, ArrowUpRight, Zap
} from 'lucide-react';
import { JobSourceBadge } from '@/components/ui/JobSourceBadge';

// ── Company initials avatar ─────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700',
];

function companyInitials(company: string): string {
  return company
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

function avatarColor(company: string): string {
  let hash = 0;
  for (let i = 0; i < company.length; i++) hash = company.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0] ?? 'bg-slate-100 text-slate-700';
}

// ── Match bar colours ───────────────────────────────────────────────────────
function matchBarColor(pct: number): string {
  if (pct >= 75) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-400';
  return 'bg-red-400';
}
function matchTextColor(pct: number): string {
  if (pct >= 75) return 'text-emerald-600';
  if (pct >= 50) return 'text-amber-600';
  return 'text-red-500';
}

// ── Time ago ────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function JobCardUI({ job }: { job: JC }) {
  const salary = job.salaryMin && job.salaryMax
    ? `€${(job.salaryMin / 1000).toFixed(0)}k – €${(job.salaryMax / 1000).toFixed(0)}k`
    : job.salaryMin ? `€${(job.salaryMin / 1000).toFixed(0)}k+` : null;

  const age     = job.postedAt ? timeAgo(job.postedAt) : null;
  const summary = job.humanSummary
    ? job.humanSummary.length > 100 ? job.humanSummary.slice(0, 97) + '…' : job.humanSummary
    : null;

  // Skill chips: show up to 4 matched skills + overflow chip
  const allSkills   = job.matchedSkills ?? [];
  const visibleSkills = allSkills.slice(0, 4);
  const overflow    = allSkills.length - visibleSkills.length;

  return (
    <div
      role="article"
      aria-label={`${job.title} at ${job.company}${job.matchPercent != null ? `, ${job.matchPercent}% match` : ''}`}
      className="group relative bg-white border border-slate-200 rounded-2xl p-5 h-full flex flex-col gap-4 hover:shadow-md hover:border-slate-300 transition-all duration-200"
    >

      {/* Left accent bar on hover */}
      <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

      {/* ── Header row: company avatar + title + source badge ── */}
      <div className="flex items-start gap-3">
        {/* Company avatar */}
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${avatarColor(job.company)}`}>
          {companyInitials(job.company) || <Building2 size={18} />}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 text-sm leading-snug truncate group-hover:text-emerald-700 transition-colors">
            {job.title}
          </h3>
          <p className="text-xs font-medium text-slate-500 truncate mt-0.5">{job.company}</p>
        </div>
      </div>

      {/* ── Match score bar ── */}
      {job.matchPercent != null && (
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-medium">Match score</span>
            <span className={`font-bold ${matchTextColor(job.matchPercent)}`}>
              {job.matchPercent}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${matchBarColor(job.matchPercent)}`}
              style={{ width: `${job.matchPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Meta row ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {job.location && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin size={12} className="text-slate-400 shrink-0" />
            <span className="truncate max-w-[120px]">{job.location}</span>
          </div>
        )}
        {salary && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Banknote size={12} className="text-slate-400 shrink-0" />
            {salary}
          </div>
        )}
        {age && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar size={12} className="text-slate-400 shrink-0" />
            {age}
          </div>
        )}
        {job.sponsorship && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <ShieldCheck size={12} className="shrink-0" />
            Sponsorship
          </div>
        )}
      </div>

      {/* ── Source + pre-match badges ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {job.sourceName ? <JobSourceBadge name={job.sourceName} /> : null}
        {job.preMatchScore != null && job.preMatchScore > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <Zap size={8} />
            {job.preMatchScore}/100
          </span>
        )}
      </div>

      {/* ── Matched skills chips ── */}
      {visibleSkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visibleSkills.map(sk => (
            <span key={sk} className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
              {sk}
            </span>
          ))}
          {overflow > 0 && (
            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-semibold border border-slate-200">
              +{overflow} more
            </span>
          )}
        </div>
      )}

      {/* ── Summary excerpt ── */}
      {summary && (
        <p className="text-[11px] leading-relaxed text-slate-500 italic line-clamp-2">
          {summary}
        </p>
      )}

      {/* ── CTA buttons ── */}
      <div className="mt-auto flex gap-2 pt-1">
        {job.sourceUrl && (
          <a
            href={job.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open original job posting"
            className="flex items-center justify-center gap-1.5 px-3.5 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-emerald-600 hover:border-emerald-200 transition-all text-xs font-semibold shrink-0"
          >
            <ExternalLink size={13} />
            Apply
          </a>
        )}
        <Link
          to={`/jobs/${job.userJobId}`}
          className="flex-1 h-9 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
        >
          View Analysis <ArrowUpRight size={13} />
        </Link>
      </div>
    </div>
  );
}

JobCardUI.displayName = 'JobCard';
