import type { JobDetail } from '@/types';
import { preprocessJobDescription } from '@/lib/jobDescriptionFormat';
import { plainJobDescription } from '@/lib/plainJobDescription';

export type JobPostingMeta = {
  salaryLabel?: string;
  workArrangement?: string;
  locationDetail?: string;
};

const META_VALUE_MAX_LEN = 120;

const NEXT_SECTION =
  "(?:Hybrid|Remote|On[- ]site|Location|About(?: the)?(?: role| us| company)?|Responsibilities|Requirements|Must have|Nice to have|Tech(?:nology)? stack|Benefits|What you(?:'|')?ll do|What we offer|Key skills|Qualifications|The role|Your role|Job description|Overview)\\s*:";

const SALARY_LINE = new RegExp(
  `(?:Salary|Compensation|Pay|Remuneration)\\s*:\\s*([^]+?)(?=\\s+${NEXT_SECTION}|$)`,
  'i',
);

const BARE_EUR_RANGE =
  /(?:€|EUR)\s*([\d,]+(?:\.\d+)?)(?:\s*k)?\s*(?:[-–—]|to)\s*(?:€|EUR)?\s*([\d,]+(?:\.\d+)?)(?:\s*k)?/i;

const HYBRID_LINE = new RegExp(
  `Hybrid\\s*:\\s*([^]+?)(?=\\s+${NEXT_SECTION}|$)`,
  'i',
);
const REMOTE_LINE = new RegExp(
  `Remote\\s*:\\s*([^]+?)(?=\\s+${NEXT_SECTION}|$)`,
  'i',
);
const ON_SITE_LINE = new RegExp(
  `On[- ]site\\s*:\\s*([^]+?)(?=\\s+${NEXT_SECTION}|$)`,
  'i',
);

const LOCATION_LINE = /Location\s*:\s*([^]+?)(?=\s+(?:Hybrid|Remote|On[- ]site|Salary|About|Responsibilities|Requirements)\s*:|$)/i;

function capMetaValue(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= META_VALUE_MAX_LEN) return trimmed;
  const cut = trimmed.slice(0, META_VALUE_MAX_LEN);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim();
}

function isVagueSalaryLabel(label: string): boolean {
  const lower = label.trim().toLowerCase();
  if (lower.includes('€') || lower.includes('eur') || lower.includes('£') || lower.includes('$')) {
    return false;
  }
  return (
    lower === 'competitive' ||
    lower === 'negotiable' ||
    lower === 'doe' ||
    lower === 'tbc' ||
    lower === 'n/a' ||
    lower.includes('not disclosed')
  );
}

function looksLikeSalary(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed || isVagueSalaryLabel(trimmed)) return false;
  if (/(?:€|EUR|£|GBP|\$|USD)/i.test(trimmed)) return true;
  return /\d[\d,]*(?:\s*k)?(?:\s*(?:-|–|—|to)\s*\d[\d,]*(?:\s*k)?)?/i.test(trimmed);
}

function parseSalaryFromText(text: string): string | undefined {
  const range = BARE_EUR_RANGE.exec(text);
  if (range) return capMetaValue(range[0]);

  const m = SALARY_LINE.exec(text);
  if (m?.[1]) {
    const snippet = (m[1].split('\n')[0] ?? m[1]).trim();
    const snippetRange = BARE_EUR_RANGE.exec(snippet);
    if (snippetRange) return capMetaValue(snippetRange[0]);
    const single = /(?:€|EUR)\s*([\d,]+(?:\.\d+)?)(?:\s*k)?/i.exec(snippet);
    if (single) return capMetaValue(single[0]);
    if (looksLikeSalary(snippet)) return capMetaValue(snippet);
  }
  return undefined;
}

function parseWorkArrangement(text: string): string | undefined {
  for (const re of [HYBRID_LINE, REMOTE_LINE, ON_SITE_LINE]) {
    const m = re.exec(text);
    if (m?.[1]?.trim()) {
      const prefix = m[0].split(':')[0]?.trim();
      const value = capMetaValue(m[1]);
      if (prefix && value) return `${prefix}: ${value}`;
    }
  }
  if (/\bhybrid\b/i.test(text) && !HYBRID_LINE.test(text)) return 'Hybrid';
  if (/\bremote\b/i.test(text) && !REMOTE_LINE.test(text)) return 'Remote';
  return undefined;
}

export function extractJobPostingMeta(job: JobDetail): JobPostingMeta {
  const plain = plainJobDescription(job.description);
  const meta: JobPostingMeta = {};

  if (job.salaryMin == null && job.salaryMax == null) {
    meta.salaryLabel = parseSalaryFromText(plain);
  }

  meta.workArrangement = parseWorkArrangement(plain);

  if (job.location?.trim()) {
    meta.locationDetail = job.location.trim();
  }

  return meta;
}

export function formatSalaryDisplay(
  job: JobDetail,
  meta?: JobPostingMeta,
): string {
  const min = job.salaryMin;
  const max = job.salaryMax;
  const currency = job.currency;
  if (min || max) {
    const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
    const fmt = (n: number) => `${symbol}${Math.round(n / 1000)}k`;
    if (min && max) return `${fmt(min)} – ${fmt(max)}`;
    if (min) return `${fmt(min)}+`;
    return `Up to ${fmt(max!)}`;
  }
  const parsed = meta?.salaryLabel ?? extractJobPostingMeta(job).salaryLabel;
  return parsed?.trim() || '';
}

export type StripPostingMetaOptions = {
  jobTitle?: string;
  salaryLabel?: string;
  locationLabel?: string;
  workArrangement?: string;
};

const STRIP_INLINE_SECTION = new RegExp(
  `(?:^|\\s)(?:Salary|Compensation|Pay|Hybrid|Remote|On[- ]site|Location)\\s*:\\s*[^]+?(?=\\s+${NEXT_SECTION}|$)`,
  'gi',
);

const STRIP_LINE_SECTION = /^(?:Salary|Compensation|Pay|Hybrid|Remote|On[- ]site|Location)\s*:\s*.+$/gim;

function normalizeTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Remove meta already shown in the posting header row so the body does not repeat it. */
export function stripPostingMetaFromDescription(
  plain: string,
  options: StripPostingMetaOptions = {},
): string {
  let text = preprocessJobDescription(plain);
  if (!text) return text;

  const titleNorm = options.jobTitle ? normalizeTitle(options.jobTitle) : '';

  const lines = text.split('\n');
  const filtered: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      filtered.push('');
      continue;
    }
    if (titleNorm && normalizeTitle(trimmed) === titleNorm) continue;
    if (/^(?:Salary|Compensation|Pay|Hybrid|Remote|On[- ]site)\s*:/i.test(trimmed)) continue;
    if (options.locationLabel && /^Location\s*:/i.test(trimmed)) continue;
    filtered.push(line);
  }
  text = filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  text = text.replace(STRIP_INLINE_SECTION, ' ').replace(STRIP_LINE_SECTION, '').trim();
  text = text.replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  return text;
}
