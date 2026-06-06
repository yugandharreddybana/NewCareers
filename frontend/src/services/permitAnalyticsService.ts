/**
 * Permit analytics API — enterprise.gov.ie employment permit statistics (2009–2026).
 */

import { api } from './api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PermitCompanyStatus = 'ACTIVE' | 'INACTIVE' | 'UNLISTED';
export type PermitMomentum = 'RISING' | 'FLAT' | 'DECLINING';
export type ReliabilityTier =
  | 'ELITE'
  | 'STRONG'
  | 'CONSISTENT'
  | 'OCCASIONAL'
  | 'NEW'
  | 'INACTIVE';

export interface PermitCompany {
  id: number;
  employerName: string;
  employerNameNormalised: string;
  sourceYear: number;
  permitsJan: number | null;
  permitsFeb: number | null;
  permitsMar: number | null;
  permitsApr: number | null;
  permitsMay: number | null;
  permitsJun: number | null;
  permitsJul: number | null;
  permitsAug: number | null;
  permitsSep: number | null;
  permitsOct: number | null;
  permitsNov: number | null;
  permitsDec: number | null;
  grandTotal: number;
  status: PermitCompanyStatus;
  momentum: PermitMomentum | null;
  rankOverall: number | null;
  reliabilityScore: number | null;
  reliabilityTier: ReliabilityTier | null;
  yearsActive: number | null;
}

export interface YearDataPoint {
  year: number;
  grandTotal: number;
  rankThatYear: number | null;
}

export type Trend3yr = 'GROWING' | 'STABLE' | 'DECLINING' | 'INSUFFICIENT_DATA';

export interface CompanyReliabilityScore {
  employerNameNormalised: string;
  canonicalName: string;
  firstSeenYear: number;
  lastSeenYear: number;
  yearsActive: number;
  totalYearsInDataset: number;
  reliabilityScore: number;
  reliabilityTier: string;
  totalPermitsAllTime: number;
  peakYear: number | null;
  peakYearTotal: number | null;
  avgAnnualPermits: number | null;
  trend3yr: Trend3yr;
  yoyChangePct: number | null;
  sectorCode: string | null;
}

export interface CompanyProfile {
  current: PermitCompany;
  reliability: CompanyReliabilityScore | null;
  yearHistory: YearDataPoint[];
}

export interface PermitSector {
  id: number;
  sectorCode: string;
  sectorName: string;
  sourceYear: number;
  permitsJan: number | null;
  permitsFeb: number | null;
  permitsMar: number | null;
  permitsApr: number | null;
  permitsMay: number | null;
  permitsJun: number | null;
  permitsJul: number | null;
  permitsAug: number | null;
  permitsSep: number | null;
  permitsOct: number | null;
  permitsNov: number | null;
  permitsDec: number | null;
  grandTotal: number;
}

export interface SectorTrendPoint {
  sectorCode: string;
  sectorName: string;
  dataPoints: { year: number; grandTotal: number }[];
}

export interface MarketTrendPoint {
  year: number;
  totalPermits: number;
  topSector: string;
  topCounty: string;
}

export interface PermitCounty {
  id: number;
  county: string;
  issued: number;
  refused: number;
  approvalRatePct: number;
}

export interface PermitSummary {
  topSectors: PermitSector[];
  topCounties: PermitCounty[];
  topSponsors: PermitCompany[];
  activeCompanyCount: number;
  totalPermits: number;
  lastRefreshed: string;
  yearsAvailable: number[];
}

export interface DomainDashboard {
  domainKey: string;
  sectorName: string;
  sectors: PermitSector[];
  topCompanies: PermitCompany[];
  counties: PermitCounty[];
  snapshotDate: string;
}

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  pageNumber: number;
}

export interface CompanySearchParams {
  q?: string;
  page?: number;
  size?: number;
  year?: number;
  momentum?: string;
  status?: string;
  tier?: string;
  minReliability?: number;
}

// ─── Backend shapes (Jackson camelCase) ──────────────────────────────────────

interface BackendCompanyProfile {
  currentYear: PermitCompany;
  reliability: CompanyReliabilityScore | null;
  yearHistory: YearDataPoint[];
}

interface BackendWatchlistItem {
  watchlistId: number;
  addedAt: string;
  company: PermitCompany;
}

interface BackendReliabilityRow extends CompanyReliabilityScore {
  id?: number;
  yearHistory?: YearDataPoint[];
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapProfile(raw: BackendCompanyProfile): CompanyProfile {
  return {
    current: raw.currentYear,
    reliability: raw.reliability,
    yearHistory: raw.yearHistory ?? [],
  };
}

function reliabilityToCompany(row: BackendReliabilityRow): PermitCompany {
  return {
    id: row.id ?? 0,
    employerName: row.canonicalName,
    employerNameNormalised: row.employerNameNormalised,
    sourceYear: row.lastSeenYear,
    permitsJan: null,
    permitsFeb: null,
    permitsMar: null,
    permitsApr: null,
    permitsMay: null,
    permitsJun: null,
    permitsJul: null,
    permitsAug: null,
    permitsSep: null,
    permitsOct: null,
    permitsNov: null,
    permitsDec: null,
    grandTotal: row.totalPermitsAllTime,
    status: 'ACTIVE',
    momentum: null,
    rankOverall: null,
    reliabilityScore: row.reliabilityScore,
    reliabilityTier: (row.reliabilityTier as ReliabilityTier) ?? null,
    yearsActive: row.yearsActive,
  };
}

function encodeName(normalisedName: string): string {
  return encodeURIComponent(normalisedName.trim());
}

// ─── API client ──────────────────────────────────────────────────────────────

export const permitAnalyticsService = {
  getSummary: (_year?: number): Promise<PermitSummary> =>
    api
      .get<PermitSummary>('/analytics/permits/summary')
      .then((r) => r.data),

  getCompanies: (params: CompanySearchParams = {}): Promise<PagedResponse<PermitCompany>> =>
    api
      .get<PagedResponse<PermitCompany>>('/analytics/permits/companies', { params })
      .then((r) => r.data),

  getCompanyProfile: (normalisedName: string): Promise<CompanyProfile> =>
    api
      .get<BackendCompanyProfile>(
        `/analytics/permits/companies/${encodeName(normalisedName)}/profile`,
      )
      .then((r) => mapProfile(r.data)),

  getCompanyHistory: (normalisedName: string): Promise<YearDataPoint[]> =>
    api
      .get<YearDataPoint[]>(
        `/analytics/permits/companies/${encodeName(normalisedName)}/history`,
      )
      .then((r) => r.data),

  getSectors: (year?: number): Promise<PermitSector[]> =>
    api
      .get<PermitSector[]>('/analytics/permits/sectors', {
        params: year != null ? { year } : undefined,
      })
      .then((r) => r.data),

  getSectorTrend: (
    from: number,
    to: number,
    codes?: string[],
  ): Promise<SectorTrendPoint[]> =>
    api
      .get<SectorTrendPoint[]>('/analytics/permits/sectors/trend', {
        params: {
          from,
          to,
          ...(codes?.length ? { codes: codes.join(',') } : {}),
        },
      })
      .then((r) => r.data),

  getCounties: (year?: number): Promise<PermitCounty[]> =>
    api
      .get<PermitCounty[]>('/analytics/permits/counties', {
        params: year != null ? { year } : undefined,
      })
      .then((r) => r.data),

  getMarketTrend: (from: number, to: number): Promise<MarketTrendPoint[]> =>
    api
      .get<MarketTrendPoint[]>('/analytics/permits/market/trend', {
        params: { from, to },
      })
      .then((r) => r.data),

  getTopReliable: (
    tier?: string,
    page = 0,
    size = 20,
  ): Promise<PagedResponse<PermitCompany>> =>
    api
      .get<PagedResponse<BackendReliabilityRow>>('/analytics/permits/reliability/top', {
        params: { tier, page, size },
      })
      .then((r) => ({
        content: r.data.content.map(reliabilityToCompany),
        totalElements: r.data.totalElements,
        totalPages: r.data.totalPages,
        pageNumber: r.data.pageNumber,
      })),

  getTopReliabilityScores: (
    tier?: string,
    page = 0,
    size = 20,
  ): Promise<PagedResponse<CompanyReliabilityScore & { id: number }>> =>
    api
      .get<PagedResponse<BackendReliabilityRow>>('/analytics/permits/reliability/top', {
        params: { tier, page, size },
      })
      .then((r) => ({
        content: r.data.content.map((row) => ({
          id: row.id ?? 0,
          employerNameNormalised: row.employerNameNormalised,
          canonicalName: row.canonicalName,
          firstSeenYear: row.firstSeenYear,
          lastSeenYear: row.lastSeenYear,
          yearsActive: row.yearsActive,
          totalYearsInDataset: row.totalYearsInDataset,
          reliabilityScore: row.reliabilityScore,
          reliabilityTier: row.reliabilityTier,
          totalPermitsAllTime: row.totalPermitsAllTime,
          peakYear: row.peakYear,
          peakYearTotal: row.peakYearTotal,
          avgAnnualPermits: row.avgAnnualPermits,
          trend3yr: row.trend3yr,
          yoyChangePct: row.yoyChangePct,
          sectorCode: row.sectorCode,
        })),
        totalElements: r.data.totalElements,
        totalPages: r.data.totalPages,
        pageNumber: r.data.pageNumber,
      })),

  getDomainDashboard: (domainKey: string, year?: number): Promise<DomainDashboard> =>
    api
      .get<DomainDashboard>(`/analytics/permits/domain/${encodeURIComponent(domainKey)}`, {
        params: year != null ? { year } : undefined,
      })
      .then((r) => r.data),

  getWatchlist: (): Promise<PermitCompany[]> =>
    api
      .get<BackendWatchlistItem[]>('/analytics/permits/watchlist')
      .then((r) => r.data.map((item) => item.company)),

  addToWatchlist: (normalisedName: string): Promise<void> =>
    api
      .post(`/analytics/permits/watchlist/${encodeName(normalisedName)}`)
      .then(() => undefined),

  removeFromWatchlist: (normalisedName: string): Promise<void> =>
    api
      .delete(`/analytics/permits/watchlist/${encodeName(normalisedName)}`)
      .then(() => undefined),
};
