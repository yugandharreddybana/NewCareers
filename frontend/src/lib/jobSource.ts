/** Display helpers for job board source names (IrishJobs, Jobs.ie, LinkedIn, …). */

const SOURCE_STYLES: Record<string, string> = {
  IrishJobs: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Jobs.ie': 'bg-teal-50 text-teal-700 border-teal-200',
  JobsIreland: 'bg-teal-50 text-teal-800 border-teal-200',
  LinkedIn: 'bg-blue-50 text-blue-700 border-blue-200',
  Adzuna: 'bg-orange-50 text-orange-700 border-orange-200',
  Indeed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Reed: 'bg-red-50 text-red-700 border-red-200',
  Remotive: 'bg-purple-50 text-purple-700 border-purple-200',
  TheMuse: 'bg-pink-50 text-pink-700 border-pink-200',
  Jobicy: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  WeWorkRemotely: 'bg-violet-50 text-violet-700 border-violet-200',
  EuroJobs: 'bg-slate-50 text-slate-700 border-slate-200',
  SerpAPI: 'bg-amber-50 text-amber-800 border-amber-200',
  remotive: 'bg-purple-50 text-purple-700 border-purple-200',
  jobsie: 'bg-teal-50 text-teal-700 border-teal-200',
  irishjobs: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const LABEL_OVERRIDES: Record<string, string> = {
  'LinkedIn (Public)': 'LinkedIn',
  'LinkedIn (Twin AI)': 'LinkedIn',
  'Indeed (RSS)': 'Indeed',
  'JobsIreland.ie': 'JobsIreland',
  'jsoup-companies': 'Company site',
  'SerpAPI (Google Jobs)': 'Google Jobs',
  'twin-linkedin': 'LinkedIn',
  themuse: 'The Muse',
  jobicy: 'Jobicy',
  remotive: 'Remotive',
  jobsie: 'Jobs.ie',
  irishjobs: 'IrishJobs',
};

export function sourceLabel(name?: string | null): string {
  if (!name?.trim()) return 'Unknown source';
  const trimmed = name.trim();
  if (LABEL_OVERRIDES[trimmed]) return LABEL_OVERRIDES[trimmed];
  return trimmed.replace(/ Careers$/i, '').trim();
}

export function getSourceStyle(name?: string | null): string {
  if (!name) return 'bg-slate-50 text-slate-600 border-slate-200';
  const label = sourceLabel(name);
  const key = Object.keys(SOURCE_STYLES).find(
    k => label.toLowerCase().includes(k.toLowerCase()) || name.toLowerCase().includes(k.toLowerCase()),
  );
  return key ? SOURCE_STYLES[key]! : 'bg-slate-50 text-slate-600 border-slate-200';
}
