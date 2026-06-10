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

// Batch 5 — filter optimistic save
export { useFiltersMutation } from './useFiltersMutation';

export { useProfileQuery, useInvalidateProfile } from './useProfile';

export {
  usePlannerTasksQuery,
  usePlannerDeadlinesQuery,
  useInvalidatePlanner,
  plannerQueryKeys,
} from './usePlanner';

export {
  useNetworkingContactsQuery,
  useInvalidateNetworking,
  networkingQueryKeys,
} from './useNetworking';
