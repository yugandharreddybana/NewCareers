const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** Formats `YYYY-MM` as "Mar 2020", or returns trimmed raw value / year-only fallback. */
export function formatYearMonthLabel(iso?: string | null): string {
  const v = iso?.trim() ?? '';
  if (!v) return '';
  const match = /^(\d{4})-(\d{2})$/.exec(v);
  if (match) {
    const year = match[1]!;
    const monthIdx = Number.parseInt(match[2]!, 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${MONTH_LABELS[monthIdx]} ${year}`;
    }
  }
  if (/^\d{4}$/.test(v)) return v;
  return v;
}

export function formatWorkDateRange(
  start?: string | null,
  end?: string | null,
  current?: boolean,
): string {
  const startLabel = formatYearMonthLabel(start);
  const endLabel = current ? 'Present' : formatYearMonthLabel(end);
  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`;
  if (startLabel) return current ? `${startLabel} – Present` : startLabel;
  if (endLabel) return endLabel;
  return '';
}

export function formatEducationYearRange(
  startYear?: string | null,
  endYear?: string | null,
  graduationYear?: string | null,
): string {
  const start = startYear?.trim() ?? '';
  const end = (endYear?.trim() || graduationYear?.trim()) ?? '';
  if (start && end) return `${start} – ${end}`;
  if (end) return end;
  if (start) return start;
  return '';
}
