/** Primary project URL extraction — mirrors backend ProjectLinkExtractor. */

const LABELED_URL =
  /(?:github|gitlab|bitbucket|demo|live|url|link|repo|repository)\s*[:\-–]\s*((?:https?:\/\/\S+)|(?:www\.\S+)|(?:github\.com\/\S+)|(?:gitlab\.com\/\S+)|(?:bitbucket\.org\/\S+))/gi;

const BARE_OR_HTTP_URL =
  /https?:\/\/[^\s<>"']+|(?:www\.)?github\.com\/[\w.\-/%]+|(?:www\.)?gitlab\.com\/[\w.\-/%]+|(?:www\.)?bitbucket\.org\/[\w.\-/%]+|(?:[\w-]+\.)?(?:vercel\.app|netlify\.app|github\.io)\/[\w.\-/%]*/gi;

function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return lower === 'link' || lower === 'demo' || lower === 'url' || lower === 'live';
}

function looksLikeBareHost(t: string): boolean {
  return (
    t.includes('github.com/') ||
    t.includes('gitlab.com/') ||
    t.includes('bitbucket.org/') ||
    t.includes('vercel.app/') ||
    t.includes('netlify.app/') ||
    t.includes('github.io/')
  );
}

export function normalizeProjectUrl(raw: string): string {
  let t = raw.trim();
  while (/[.,;)\]}]$/.test(t)) {
    t = t.slice(0, -1).trim();
  }
  if (!t || isPlaceholder(t)) return '';
  const lower = t.toLowerCase();
  if (lower.startsWith('mailto:') || lower.includes('linkedin.com/in/')) return '';
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('www.')) return `https://${t}`;
  if (looksLikeBareHost(t)) return `https://${t}`;
  return '';
}

function repoScore(url: string): number {
  const lower = url.toLowerCase();
  if (lower.includes('github.com/') || lower.includes('gitlab.com/') || lower.includes('bitbucket.org/')) {
    return 100;
  }
  if (lower.includes('github.io/')) return 80;
  if (lower.includes('vercel.app/') || lower.includes('netlify.app/')) return 60;
  return 40;
}

export function findProjectUrls(text: string): string[] {
  if (!text.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (raw: string) => {
    const normalized = normalizeProjectUrl(raw);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  };

  for (const match of text.matchAll(LABELED_URL)) {
    if (match[1]) add(match[1]);
  }
  for (const match of text.matchAll(BARE_OR_HTTP_URL)) {
    if (match[0]) add(match[0]);
  }

  return out;
}

export function extractPrimaryProjectLink(text: string): string {
  const candidates = findProjectUrls(text);
  if (candidates.length === 0) return '';
  return candidates.reduce((best, cur) => (repoScore(cur) > repoScore(best) ? cur : best));
}

export function stripProjectUrls(text: string): string {
  return text
    .replace(LABELED_URL, '')
    .replace(BARE_OR_HTTP_URL, '')
    .replace(/^\s*[•\-*▪►#]+\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function promoteProjectLink(fields: {
  projectLink: string;
  projectDetails: string;
  projectName?: string;
}): { projectLink: string; projectDetails: string } {
  let projectLink = fields.projectLink.trim();
  let projectDetails = fields.projectDetails.trim();

  if (!projectLink) {
    const combined = [fields.projectName ?? '', projectDetails].filter(Boolean).join('\n');
    projectLink = extractPrimaryProjectLink(combined);
  }

  if (projectLink) {
    projectDetails = stripProjectUrls(projectDetails);
  }

  return { projectLink, projectDetails };
}
