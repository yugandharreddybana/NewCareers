import type { SearchParams } from '@/services/discoveryApi';

/** Central query-key factory — keeps cache invalidation predictable. */
export const queryKeys = {
  jobs: {
    all: ['jobs'] as const,
    list: () => [...queryKeys.jobs.all, 'list'] as const,
    detail: (userJobId: string) => [...queryKeys.jobs.all, 'detail', userJobId] as const,
    stats: () => [...queryKeys.jobs.all, 'stats'] as const,
    limits: () => [...queryKeys.jobs.all, 'limits'] as const,
  },
  discovery: {
    all: ['discovery'] as const,
    recommended: () => [...queryKeys.discovery.all, 'recommended'] as const,
    search: (params: SearchParams) => [...queryKeys.discovery.all, 'search', params] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    summary: () => [...queryKeys.analytics.all, 'summary'] as const,
    timeSeries: (weeks: number) => [...queryKeys.analytics.all, 'time-series', weeks] as const,
    funnel: () => [...queryKeys.analytics.all, 'funnel'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    unread: () => [...queryKeys.notifications.all, 'unread'] as const,
    page: (page: number, size: number) => [...queryKeys.notifications.all, 'page', page, size] as const,
  },
  profile: {
    all: ['profile'] as const,
    current: () => [...queryKeys.profile.all, 'current'] as const,
  },
  progress: {
    all: ['progress'] as const,
    weekly: () => [...queryKeys.progress.all, 'weekly'] as const,
    streaks: () => [...queryKeys.progress.all, 'streaks'] as const,
  },
  cv: {
    all: ['cv'] as const,
    versions: () => [...queryKeys.cv.all, 'versions'] as const,
  },
  onboarding: {
    all: ['onboarding'] as const,
    delivery: () => [...queryKeys.onboarding.all, 'delivery'] as const,
  },
  usage: {
    all: ['usage'] as const,
    limits: () => [...queryKeys.usage.all, 'limits'] as const,
  },
  permits: {
    all: ['permits'] as const,
    summary: (year?: number) => [...queryKeys.permits.all, 'summary', year] as const,
    companies: (params: Record<string, unknown>) =>
      [...queryKeys.permits.all, 'companies', params] as const,
    companyProfile: (name: string) => [...queryKeys.permits.all, 'profile', name] as const,
    companyHistory: (name: string) => [...queryKeys.permits.all, 'history', name] as const,
    sectors: (year?: number) => [...queryKeys.permits.all, 'sectors', year] as const,
    sectorTrend: (from: number, to: number, codes?: string[]) =>
      [...queryKeys.permits.all, 'sectorTrend', from, to, codes] as const,
    counties: (year?: number) => [...queryKeys.permits.all, 'counties', year] as const,
    marketTrend: (from: number, to: number) =>
      [...queryKeys.permits.all, 'marketTrend', from, to] as const,
    topReliable: (tier?: string, page?: number) =>
      [...queryKeys.permits.all, 'reliable', tier, page] as const,
    domain: (key: string, year?: number) =>
      [...queryKeys.permits.all, 'domain', key, year] as const,
    watchlist: () => [...queryKeys.permits.all, 'watchlist'] as const,
  },
} as const;
