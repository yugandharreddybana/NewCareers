/**
 * VirtualJobFeed.tsx — Batch 5
 *
 * Renders a large, potentially 100-1000 item job list using react-window's
 * VariableSizeList so only the ~10 visible cards are in the DOM at any time.
 *
 * Usage:
 *   <VirtualJobFeed
 *     jobs={jobs}
 *     height={600}            // outer container height in px (required)
 *     onNearBottom={prefetch} // called when user is within 3 cards of end
 *     renderCard={(job) => <MyJobCard job={job} />}
 *   />
 *
 * Design decisions:
 *   – VariableSizeList over FixedSizeList so cards can have dynamic content
 *     (e.g. salary range, tags) without cropping.
 *   – Default item height is 120px; rendered cards that differ will cause the
 *     size cache to reset on the next paint (acceptably rare).
 *   – The list ref is forwarded so parent pages can call
 *     `listRef.current?.scrollToItem(0)` on filter changes.
 *   – onNearBottom fires when the user is within PREFETCH_THRESHOLD items of
 *     the end, giving the parent time to fetch the next page.
 */
import {
  memo,
  useCallback,
  useRef,
  type ReactNode,
  forwardRef,
} from 'react';
import { VariableSizeList, type ListChildComponentProps } from 'react-window';

const DEFAULT_ITEM_HEIGHT = 120;
const PREFETCH_THRESHOLD = 3;

export type VirtualJobFeedItem = {
  /** Unique stable key for this list item */
  id: string;
};

type Props<T extends VirtualJobFeedItem> = {
  jobs: T[];
  /** Outer container height in px */
  height: number;
  /** Width – defaults to '100%' */
  width?: number | string;
  /** Called when scroll position is within PREFETCH_THRESHOLD items of end */
  onNearBottom?: () => void;
  /** Return the JSX for a single card */
  renderCard: (item: T, index: number) => ReactNode;
  /** Per-item height override; falls back to DEFAULT_ITEM_HEIGHT */
  getItemHeight?: (index: number) => number;
  /** Passed through to the outer div for styling */
  className?: string;
};

// Row wrapper — memoised so re-renders of the parent list don't touch
// unchanged rows. The actual card JSX is produced by the parent's renderCard.
const Row = memo(function Row({
  index,
  style,
  data,
}: ListChildComponentProps<{
  jobs: VirtualJobFeedItem[];
  renderCard: (item: VirtualJobFeedItem, index: number) => ReactNode;
}>) {
  const job = data.jobs[index];
  if (!job) return null;
  return (
    <div style={style} className="px-1 py-1">
      {data.renderCard(job, index)}
    </div>
  );
});

function VirtualJobFeedInner<T extends VirtualJobFeedItem>(
  {
    jobs,
    height,
    width = '100%',
    onNearBottom,
    renderCard,
    getItemHeight,
    className,
  }: Props<T>,
  ref: React.ForwardedRef<VariableSizeList>,
) {
  const internalRef = useRef<VariableSizeList>(null);
  const listRef = (ref as React.MutableRefObject<VariableSizeList | null>) ?? internalRef;

  const itemSize = useCallback(
    (index: number) => (getItemHeight ? getItemHeight(index) : DEFAULT_ITEM_HEIGHT),
    [getItemHeight],
  );

  const handleScroll = useCallback(
    ({ scrollOffset }: { scrollOffset: number }) => {
      if (!onNearBottom) return;
      // Estimate visible bottom item index
      let accumulated = 0;
      let visibleEnd = 0;
      for (let i = 0; i < jobs.length; i++) {
        accumulated += itemSize(i);
        if (accumulated >= scrollOffset + height) {
          visibleEnd = i;
          break;
        }
        visibleEnd = i;
      }
      if (jobs.length - visibleEnd <= PREFETCH_THRESHOLD) {
        onNearBottom();
      }
    },
    [jobs.length, height, itemSize, onNearBottom],
  );

  // Stable item data object to prevent Row re-renders
  const itemData = { jobs, renderCard: renderCard as (item: VirtualJobFeedItem, index: number) => ReactNode };

  return (
    <div className={className}>
      <VariableSizeList
        ref={listRef}
        height={height}
        width={width}
        itemCount={jobs.length}
        itemSize={itemSize}
        itemData={itemData}
        onScroll={handleScroll}
        overscanCount={4}
      >
        {Row}
      </VariableSizeList>
    </div>
  );
}

/**
 * VirtualJobFeed — generic virtualised list for job cards.
 *
 * Accepts a `ref` of type `React.RefObject<VariableSizeList>` so parents can
 * call `.scrollToItem(0)` after filter changes.
 */
export const VirtualJobFeed = forwardRef(VirtualJobFeedInner) as <
  T extends VirtualJobFeedItem,
>(
  props: Props<T> & { ref?: React.Ref<VariableSizeList> },
) => JSX.Element;
