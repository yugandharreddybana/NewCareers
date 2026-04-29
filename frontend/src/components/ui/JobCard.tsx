import { Link } from 'react-router-dom';
import { JobCard as JC } from '@/types';
import MatchCircle from './MatchCircle';
import { MapPin, Banknote, Calendar, ShieldCheck, ArrowUpRight, Building2 } from 'lucide-react';

export default function JobCardUI({ job }: { job: JC }) {
  const salary = job.salaryMin && job.salaryMax
    ? `€${(job.salaryMin / 1000).toFixed(0)}k – €${(job.salaryMax / 1000).toFixed(0)}k`
    : job.salaryMin ? `€${(job.salaryMin / 1000).toFixed(0)}k+` : null;

  const age = job.postedAt ? timeAgo(job.postedAt) : null;

  return (
    <div className="card h-full flex flex-col gap-5 hover:border-brand-vibrant/30 group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-brand-vibrant/5 group-hover:border-brand-vibrant/10 transition-colors">
            <Building2 className="text-slate-400 group-hover:text-brand-vibrant transition-colors" size={24} />
          </div>
          <div className="min-w-0 pt-1">
            <h3 className="font-bold text-slate-900 truncate leading-tight group-hover:text-brand-vibrant transition-colors">{job.title}</h3>
            <p className="text-sm font-medium text-slate-500 truncate">{job.company}</p>
          </div>
        </div>
        {job.matchPercent != null && (
          <div className="shrink-0 scale-90 origin-top-right">
             <MatchCircle percent={job.matchPercent} size={50} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <MapPin size={14} className="text-slate-400" />
          <span className="truncate">{job.location || 'Remote'}</span>
        </div>
        {salary && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Banknote size={14} className="text-slate-400" />
            <span className="truncate">{salary}</span>
          </div>
        )}
        {age && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Calendar size={14} className="text-slate-400" />
            <span className="truncate">{age}</span>
          </div>
        )}
        {job.sponsorship && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
            <ShieldCheck size={14} />
            <span className="truncate">Sponsorship</span>
          </div>
        )}
      </div>

      {job.verdict && (
        <div className="px-3 py-2 rounded-lg bg-slate-50 text-[11px] font-medium text-slate-600 leading-relaxed italic border border-slate-100">
          "{job.verdict}"
        </div>
      )}

      <div className="mt-auto pt-2">
        <Link
          to={`/jobs/${job.userJobId}`}
          className="btn btn-primary w-full text-sm group-hover:shadow-glow transition-all"
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
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}
