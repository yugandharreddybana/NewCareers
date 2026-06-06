/**
 * React Query hooks for permit analytics (/analytics/permits).
 */

import { useEffect, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import {
  permitAnalyticsService,
  type CompanySearchParams,
  type PermitCompany,
} from '@/services/permitAnalyticsService';

const STALE_1H = 60 * 60 * 1000;
const STALE_24H = 24 * 60 * 60 * 1000;

export function usePermitSummary(year?: number) {
  return useQuery({
    queryKey: queryKeys.permits.summary(year),
    queryFn: () => permitAnalyticsService.getSummary(year),
    staleTime: STALE_1H,
  });
}

export function usePermitCompanies(
  params: CompanySearchParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.permits.companies(params as Record<string, unknown>),
    queryFn: () => permitAnalyticsService.getCompanies(params),
    enabled: options?.enabled ?? true,
    staleTime: STALE_1H,
    placeholderData: keepPreviousData,
  });
}

/** Debounced typeahead search — runs when query length ≥ 2. */
export function usePermitSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  return usePermitCompanies(
    { q: debouncedQuery, page: 0, size: 20 },
    { enabled: debouncedQuery.trim().length >= 2 },
  );
}

export function useCompanyProfile(normalisedName: string) {
  return useQuery({
    queryKey: queryKeys.permits.companyProfile(normalisedName),
    queryFn: () => permitAnalyticsService.getCompanyProfile(normalisedName),
    enabled: !!normalisedName?.trim(),
    staleTime: STALE_24H,
  });
}

export function useCompanyHistory(normalisedName: string) {
  return useQuery({
    queryKey: queryKeys.permits.companyHistory(normalisedName),
    queryFn: () => permitAnalyticsService.getCompanyHistory(normalisedName),
    enabled: !!normalisedName?.trim(),
    staleTime: STALE_24H,
  });
}

export function usePermitSectors(year?: number) {
  return useQuery({
    queryKey: queryKeys.permits.sectors(year),
    queryFn: () => permitAnalyticsService.getSectors(year),
    staleTime: STALE_1H,
  });
}

export function useSectorTrend(from: number, to: number, codes?: string[]) {
  return useQuery({
    queryKey: queryKeys.permits.sectorTrend(from, to, codes),
    queryFn: () => permitAnalyticsService.getSectorTrend(from, to, codes),
    staleTime: STALE_24H,
  });
}

export function usePermitCounties(year?: number) {
  return useQuery({
    queryKey: queryKeys.permits.counties(year),
    queryFn: () => permitAnalyticsService.getCounties(year),
    staleTime: STALE_1H,
  });
}

export function useMarketTrend(from: number, to: number) {
  return useQuery({
    queryKey: queryKeys.permits.marketTrend(from, to),
    queryFn: () => permitAnalyticsService.getMarketTrend(from, to),
    staleTime: STALE_24H,
  });
}

export function useTopReliableCompanies(tier?: string, page = 0, size = 20) {
  return useQuery({
    queryKey: queryKeys.permits.topReliable(tier, page),
    queryFn: () => permitAnalyticsService.getTopReliable(tier, page, size),
    staleTime: STALE_1H,
    placeholderData: keepPreviousData,
  });
}

export function useTopReliabilityScores(tier?: string, page = 0, size = 20) {
  return useQuery({
    queryKey: [...queryKeys.permits.topReliable(tier, page), 'scores'] as const,
    queryFn: () => permitAnalyticsService.getTopReliabilityScores(tier, page, size),
    staleTime: STALE_1H,
    placeholderData: keepPreviousData,
  });
}

export function usePermitDomainDashboard(domainKey: string, year?: number) {
  return useQuery({
    queryKey: queryKeys.permits.domain(domainKey, year),
    queryFn: () => permitAnalyticsService.getDomainDashboard(domainKey, year),
    enabled: !!domainKey?.trim(),
    staleTime: STALE_1H,
  });
}

export function usePermitWatchlist() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.permits.watchlist(),
    queryFn: () => permitAnalyticsService.getWatchlist(),
    enabled: !!user,
    staleTime: STALE_1H,
  });
}

export function useWatchlistMutation() {
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: (normalisedName: string) =>
      permitAnalyticsService.addToWatchlist(normalisedName),
    onMutate: async (normalisedName) => {
      await qc.cancelQueries({ queryKey: queryKeys.permits.watchlist() });
      const prev = qc.getQueryData<PermitCompany[]>(queryKeys.permits.watchlist());
      const optimistic: PermitCompany = {
        id: 0,
        employerName: normalisedName,
        employerNameNormalised: normalisedName,
        sourceYear: new Date().getFullYear(),
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
        grandTotal: 0,
        status: 'ACTIVE',
        momentum: null,
        rankOverall: null,
        reliabilityScore: null,
        reliabilityTier: null,
        yearsActive: null,
      };
      if (prev && !prev.some((c) => c.employerNameNormalised === normalisedName)) {
        qc.setQueryData<PermitCompany[]>(queryKeys.permits.watchlist(), [
          optimistic,
          ...prev,
        ]);
      }
      return { prev };
    },
    onError: (_err, _name, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(queryKeys.permits.watchlist(), ctx.prev);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.permits.watchlist() });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (normalisedName: string) =>
      permitAnalyticsService.removeFromWatchlist(normalisedName),
    onMutate: async (normalisedName) => {
      await qc.cancelQueries({ queryKey: queryKeys.permits.watchlist() });
      const prev = qc.getQueryData<PermitCompany[]>(queryKeys.permits.watchlist());
      if (prev) {
        qc.setQueryData<PermitCompany[]>(
          queryKeys.permits.watchlist(),
          prev.filter((c) => c.employerNameNormalised !== normalisedName),
        );
      }
      return { prev };
    },
    onError: (_err, _name, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(queryKeys.permits.watchlist(), ctx.prev);
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.permits.watchlist() });
    },
  });

  return { addMutation, removeMutation };
}
