export const SECTOR_COLORS: Record<string, string> = {
  J: '#0d9488',
  Q: '#2563eb',
  K: '#7c3aed',
  F: '#db2777',
  I: '#ea580c',
  C: '#ca8a04',
  P: '#16a34a',
  A: '#0891b2',
  G: '#9333ea',
  N: '#e11d48',
  default: '#6b7280',
};

export type SelectedYear = number | 'all';

export const YEAR_TABS: { label: string; value: SelectedYear }[] = [
  { label: '2026 (Live)', value: 2026 },
  { label: '2025', value: 2025 },
  { label: '2024', value: 2024 },
  { label: '2023', value: 2023 },
  { label: 'All Years', value: 'all' },
];

export const MONTH_FIELDS = [
  { key: 'permitsJan', label: 'Jan' },
  { key: 'permitsFeb', label: 'Feb' },
  { key: 'permitsMar', label: 'Mar' },
  { key: 'permitsApr', label: 'Apr' },
  { key: 'permitsMay', label: 'May' },
  { key: 'permitsJun', label: 'Jun' },
  { key: 'permitsJul', label: 'Jul' },
  { key: 'permitsAug', label: 'Aug' },
  { key: 'permitsSep', label: 'Sep' },
  { key: 'permitsOct', label: 'Oct' },
  { key: 'permitsNov', label: 'Nov' },
  { key: 'permitsDec', label: 'Dec' },
] as const;

export const TIER_TABS = [
  { id: '', label: 'All' },
  { id: 'ELITE', label: '🏆 Elite' },
  { id: 'STRONG', label: '⭐ Strong' },
  { id: 'CONSISTENT', label: '✅ Consistent' },
  { id: 'OCCASIONAL', label: '📊 Occasional' },
  { id: 'NEW', label: '🆕 New' },
] as const;
