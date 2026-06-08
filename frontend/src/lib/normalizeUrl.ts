/** Ensures portfolio/project URLs satisfy backend http(s) validation. */
export function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('www.')) return `https://${t}`;
  return `https://${t}`;
}

export function isLikelyValidUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  try {
    const url = new URL(normalizeUrl(t));
    return Boolean(url.hostname);
  } catch {
    return false;
  }
}
