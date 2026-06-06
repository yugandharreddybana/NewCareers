import { SECTOR_COLORS } from './constants';

export function formatIE(n: number): string {
  return n.toLocaleString('en-IE');
}

export function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

const SECTOR_FALLBACK = '#6b7280';

export function sectorColor(code: string): string {
  return SECTOR_COLORS[code.toUpperCase()] ?? SECTOR_FALLBACK;
}
