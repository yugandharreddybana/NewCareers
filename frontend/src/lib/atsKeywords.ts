import type { Profile } from '@/types';

/** Profile + CV terms used for ATS keyword matching. */
export function buildAtsKeywords(
  profile?: Pick<Profile, 'techStack' | 'targetRoles' | 'atsKeywords'> | null,
): string[] {
  if (!profile) return [];
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (term: string) => {
    const t = term.trim();
    if (t.length < 2) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  // Server-derived from CV + profile (preferred)
  for (const skill of profile.atsKeywords ?? []) add(skill);
  for (const skill of profile.techStack ?? []) add(skill);

  for (const role of profile.targetRoles ?? []) {
    for (const part of role.split(/\s+/)) {
      if (part.length >= 3 && !/^(and|the|for|with|senior|junior|lead|staff)$/i.test(part)) {
        add(part);
      }
    }
  }

  return out.sort((a, b) => b.length - a.length);
}

export function partitionAtsKeywords(
  description: string,
  keywords: string[],
): { matched: string[]; unmatched: string[] } {
  const haystack = description.toLowerCase();
  const matched: string[] = [];
  const unmatched: string[] = [];
  for (const kw of keywords) {
    if (haystack.includes(kw.toLowerCase())) matched.push(kw);
    else unmatched.push(kw);
  }
  return { matched, unmatched };
}

export type AtsHighlightSpan = {
  text: string;
  tone: 'match' | 'gap' | 'plain';
};

/**
 * Split description into spans; only ATS keywords from the user profile are highlighted.
 * Green = keyword appears in posting; plain text otherwise.
 */
export function highlightAtsInText(text: string, keywords: string[]): AtsHighlightSpan[] {
  if (!text || keywords.length === 0) return [{ text, tone: 'plain' }];

  const sorted = [...keywords].sort((a, b) => b.length - a.length);
  const pattern = sorted
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  if (!pattern) return [{ text, tone: 'plain' }];

  const re = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(re);
  const spans: AtsHighlightSpan[] = [];

  for (const part of parts) {
    if (!part) continue;
    const isKeyword = sorted.some(k => k.toLowerCase() === part.toLowerCase());
    spans.push({ text: part, tone: isKeyword ? 'match' : 'plain' });
  }

  return spans.length ? spans : [{ text, tone: 'plain' }];
}
