export function formatSecurityDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
  if (sameDay) {
    return `Today, ${new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(d)}`;
  }
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatRelativeActive(iso: string, current: boolean): string {
  if (current) return 'Active now';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'Active now';
  if (diffMin < 60) return `Last seen: ${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return `Last seen: ${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.round(diffHr / 24);
  return `Last seen: ${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

export function isMobileUserAgent(ua: string | null): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return lower.includes('iphone') || lower.includes('ipad') || lower.includes('android') || lower.includes('mobile');
}
