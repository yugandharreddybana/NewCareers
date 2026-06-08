/**
 * useScrollPrefetch.ts — Batch 5
 *
 * A thin hook that bridges the VirtualJobFeed's onNearBottom callback with
 * TanStack Query's fetchNextPage.
 *
 * Design:
 *   – Guards with a ref so fetchNextPage is only called once per "near bottom"
 *     event, even if the VirtualJobFeed fires multiple scroll events quickly.
 *   – Automatically resets the guard when isFetchingNextPage goes back to
 *     false (i.e. the page has loaded), so the user can trigger further pages.
 *
 * Usage:
 *   const { onNearBottom } = useScrollPrefetch({
 *     hasNextPage,
 *     isFetchingNextPage,
 *     fetchNextPage,
 *   });
 *   <VirtualJobFeed onNearBottom={onNearBottom} ... />
 */
import { useCallback, useEffect, useRef } from 'react';

type Params = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void | Promise<unknown>;
};

export function useScrollPrefetch({ hasNextPage, isFetchingNextPage, fetchNextPage }: Params) {
  const fetchingRef = useRef(false);

  // Reset gate once the previous fetch completes
  useEffect(() => {
    if (!isFetchingNextPage) {
      fetchingRef.current = false;
    }
  }, [isFetchingNextPage]);

  const onNearBottom = useCallback(() => {
    if (!hasNextPage || fetchingRef.current) return;
    fetchingRef.current = true;
    void Promise.resolve(fetchNextPage()).catch(() => {
      // Allow retry after failure; isFetchingNextPage may never flip true on throw
      fetchingRef.current = false;
    });
  }, [hasNextPage, fetchNextPage]);

  return { onNearBottom };
}
