import { Link } from 'react-router-dom';
import { JobCard as JC } from '@/types';
import MatchCircle from './MatchCircle';
import {
  MapPin, Banknote, Calendar, ShieldCheck,
  ArrowUpRight, Building2, ExternalLink, Zap
} from 'lucide-react';

// ── Source badge colour map ───────────────────────────────────────────────
const SOURCE_STYLES: Record<string, string> = {
  'LinkedIn (Twin AI)': 'bg-blue-50 text-blue-700 border-blue-200',
  'IrishJobs':          'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Jobs.ie':            'bg-teal-50 text-teal-700 border-teal-200',
  'Reed':               'bg-red-50 text-red-700 border-red-200',
  'Adzuna':             'bg-orange-50 text-orange-700 border-orange-200',
  'Remotive':           'bg-purple-50 text-purple-700 border-purple-200',
  'TheMuse':            'bg-pink-50 text-pink-700 border-pink-200',
  'Jobicy':             'bg-yellow-50 text-yellow-700 border-yellow-200',
};

function getSourceStyle(sourceName?: string): string {
  if (!sourceName) return 'bg-slate-50 text-slate-500 border-slate-200';
  // Company career pages (from JsoupCompanySource) show company name
  const key = Object.keys(SOURCE_STYLES).find(
    k => sourceName.toLowerCase().includes(k.toLowerCase())
  );
  return key ? SOURCE_STYLES[key] : 'bg-slate-50 text-slate-500 border-slate-200';
}

function sourceLabel(sourceName?: string): string {
  if (!sourceName) return 'Job Board';
  // Strip " Careers" suffix added by JsoupCompanySource
  return sourceName.replace(/ Careers$/i, '').trim();
}

export default function JobCardUI({ job }: { job: JC }) {
  const salary = job.salaryMin && job.salaryMax
    ? `€${(job.salaryMin / 1000).toFixed(0)}k – €${(job.salaryMax / 1000).toFixed(0)}k`
    : job.salaryMin ? `€${(job.salaryMin / 1000).toFixed(0)}k+` : null;

  const age = job.postedAt ? timeAgo(job.postedAt) : null;

  // Truncate humanSummary to 110 chars for card preview
  const summary = job.humanSummary
    ? job.humanSummary.length > 110
      ? job.humanSummary.slice(0, 107) + '…'
      : job.humanSummary
    : null;

  return (
    <div className="card h-full flex flex-col gap-4 hover:border-brand-vibrant/30 group">

      {/* ── Top row: company icon + title + match ring ─── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-brand-vibrant/5 group-hover:border-brand-vibrant/10 transition-colors">
            <Building2 className="text-slate-400 group-hover:text-brand-vibrant transition-colors" size={24} />
          </div>
          <div className="min-w-0 pt-1">
            <h3 className="font-bold text-slate-900 truncate leading-tight group-hover:text-brand-vibrant transition-colors">
              {job.title}
            </h3>
            <p className="text-sm font-medium text-slate-500 truncate">{job.company}</p>
          </div>
        </div>
        {job.matchPercent != null && (
          <div className="shrink-0 scale-90 origin-top-right">
            <MatchCircle percent={job.matchPercent} size={50} />
          </div>
        )}
      </div>

      {/* ── Source badge + pre-match score ─────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {job.sourceName && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            getSourceStyle(job.sourceName)
          }`}>
            <ExternalLink size={9} />
            {sourceLabel(job.sourceName)}
          </span>
        )}
        {job.preMatchScore != null && job.preMatchScore > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-vibrant/5 text-brand-vibrant border border-brand-vibrant/20">
            <Zap size={9} />
            {job.preMatchScore}/100 relevance
          </span>
        )}
      </div>

      {/* ── Meta row: location / salary / age / sponsorship ── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <MapPin size={13} className="text-slate-400 shrink-0" />
          <span className="truncate">{job.location || 'Remote'}</span>
        </div>
        {salary && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Banknote size={13} className="text-slate-400 shrink-0" />
            <span className="truncate">{salary}</span>
          </div>
        )}
        {age && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Calendar size={13} className="text-slate-400 shrink-0" />
            <span className="truncate">{age}</span>
          </div>
        )}
        {job.sponsorship && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
            <ShieldCheck size={13} className="shrink-0" />
            <span className="truncate">Sponsorship</span>
          </div>
        )}
      </div>

      {/* ── Gemini human summary excerpt ────────────────── */}
      {summary && (
        <p className="text-[11px] leading-relaxed text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 italic">
          {summary}
        </p>
      )}

      {/* ── Verdict chip (if no summary) ────────────────── */}
      {!summary && job.verdict && (
        <div className="px-3 py-2 rounded-lg bg-slate-50 text-[11px] font-medium text-slate-600 leading-relaxed italic border border-slate-100">
          "{job.verdict}"
        </div>
      )}

      {/* ── CTA buttons ─────────────────────────────────── */}
      <div className="mt-auto pt-1 flex gap-2">
        {/* Direct link to the original job posting */}
        {job.sourceUrl && (
          <a
            href={job.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-brand-vibrant hover:border-brand-vibrant/30 transition-all text-xs font-bold shrink-0 shadow-sm"
            title="Open original job posting"
          >
            <ExternalLink size={14} />
            Apply
          </a>
        )}

        {/* In-app detail / AI analysis view */}
        <Link
          to={`/jobs/${job.userJobId}`}
          className="btn btn-primary flex-1 text-sm group-hover:shadow-glow transition-all"
        >
          View Analysis
          <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}
