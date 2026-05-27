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
} as const;
