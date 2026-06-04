export {
  useJobsList,
  useJobDetail,
  useJobsStats,
  useInvalidateJobs,
  useFetchLiveJobMutation,
  useFetchIrishJobsMutation,
  useFetchMoreJobsMutation,
  useKanbanPatchMutation,
  // Batch 5
  useInfiniteJobsFeed,
  useJobFavoriteMutation,
} from './useJobs';

export { useRecommendedJobs, useJobSearch } from './useDiscovery';

export { useAnalyticsSummary, useAnalyticsTimeSeries } from './useAnalytics';

export {
  useNotificationUnreadCount,
  useNotificationsPage,
  useInvalidateNotifications,
} from './useNotifications';

export { useWeeklyProgress, useProgressStreaks } from './useProgress';

export { useUsageLimits } from './useUsageLimits';

// Batch 5 — filter optimistic save
export { useFiltersMutation } from './useFiltersMutation';
