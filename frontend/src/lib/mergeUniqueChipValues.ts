/** Case-insensitive merge for chip multi-select values. */
export function mergeUniqueChipValues(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map(v => v.toLowerCase()));
  const out = [...existing];
  for (const value of incoming) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
