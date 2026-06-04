/**
 * VirtualJobFeed.tsx — Batch 5 (production-hardened)
 *
 * Renders a large job list using react-window's VariableSizeList so only
 * ~10 visible cards are in the DOM at any time.
 *
 * Production fixes over initial Batch 5 commit:
 *   F1 – forwardRef now exposes a stable handle { scrollToItem } instead of
 *        the raw VariableSizeList ref, so parent pages are not coupled to
 *        react-window internals.
 *   F2 – handleScroll is no longer O(n) per event; it uses a cumulative
 *        height estimate (constant per event) via itemSize.
 *   F3 – itemData is stabilised with useMemo so Row never re-renders due to
 *        a new object reference on each parent render.
 *   F4 – overscanCount raised to 5 for smoother fast-scroll on slow devices.
 *   F5 – Accessible role="feed" + aria-label on the outer div.
 */
import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { VariableSizeList, type ListChildComponentProps } from 'react-window';

const DEFAULT_ITEM_HEIGHT = 240; // realistic card height (matches CSS)
const PREFETCH_THRESHOLD  = 3;

// Public handle exposed via forwardRef — parents import this type.
export type VirtualJobFeedHandle = {
  scrollToItem: (index: number, align?: 'auto' | 'start' | 'center' | 'end') => void;
};

export type VirtualJobFeedItem = { id: string };

type Props<T extends VirtualJobFeedItem> = {
  jobs: T[];
  /** Outer container height in px */
  height: number;
  width?: number | string;
  /** Called when scroll position is within PREFETCH_THRESHOLD items of end */
  onNearBottom?: () => void;
  /** Return the JSX for a single card */
  renderCard: (item: T, index: number) => ReactNode;
  /** Override height for a specific index; falls back to DEFAULT_ITEM_HEIGHT */
  getItemHeight?: (index: number) => number;
  className?: string;
  'aria-label'?: string;
};

// ── Internal row component ──────────────────────────────────────────────────
type RowData<T extends VirtualJobFeedItem> = {
  jobs: T[];
  renderCard: (item: T, index: number) => ReactNode;
};

const Row = memo(function Row<T extends VirtualJobFeedItem>({
  index,
  style,
  data,
}: ListChildComponentProps<RowData<T>>) {
  const job = data.jobs[index];
  if (!job) return null;
  return (
    <div style={style} className="px-1 py-1.5">
      {data.renderCard(job, index)}
    </div>
  );
}) as <T extends VirtualJobFeedItem>(props: ListChildComponentProps<RowData<T>>) => JSX.Element | null;

// ── VirtualJobFeedInner ─────────────────────────────────────────────────────
function VirtualJobFeedInner<T extends VirtualJobFeedItem>(
  {
    jobs,
    height,
    width = '100%',
    onNearBottom,
    renderCard,
    getItemHeight,
    className,
    'aria-label': ariaLabel = 'Job listings',
  }: Props<T>,
  ref: React.ForwardedRef<VirtualJobFeedHandle>,
) {
  const listRef = useRef<VariableSizeList>(null);

  // F1 – expose a stable public handle, not the raw react-window ref
  useImperativeHandle(
    ref,
    () => ({
      scrollToItem: (index, align = 'auto') => {
        listRef.current?.scrollToItem(index, align);
      },
    }),
    [],
  );

  const itemSize = useCallback(
    (index: number) => (getItemHeight ? getItemHeight(index) : DEFAULT_ITEM_HEIGHT),
    [getItemHeight],
  );

  // F2 – O(1) per scroll event: estimate visible bottom by dividing scroll
  //      offset + container height by the average (default) item height.
  const handleScroll = useCallback(
    ({ scrollOffset }: { scrollOffset: number }) => {
      if (!onNearBottom || jobs.length === 0) return;
      const avgHeight = DEFAULT_ITEM_HEIGHT;
      const visibleEndIndex = Math.floor((scrollOffset + height) / avgHeight);
      if (jobs.length - visibleEndIndex <= PREFETCH_THRESHOLD) {
        onNearBottom();
      }
    },
    [jobs.length, height, onNearBottom],
  );

  // F3 – stable itemData reference so Row doesn't re-render unnecessarily
  const itemData = useMemo<RowData<T>>(
    () => ({ jobs, renderCard }),
    [jobs, renderCard],
  );

  return (
    <div className={className} role="feed" aria-label={ariaLabel} aria-busy={false}>
      <VariableSizeList
        ref={listRef}
        height={height}
        width={width}
        itemCount={jobs.length}
        itemSize={itemSize}
        itemData={itemData}
        onScroll={handleScroll}
        overscanCount={5}
      >
        {Row as React.ComponentType<ListChildComponentProps<RowData<T>>>}
      </VariableSizeList>
    </div>
  );
}

/**
 * VirtualJobFeed
 *
 * Generic virtualised list for job cards.
 * Accepts a `ref` typed as `VirtualJobFeedHandle` (not VariableSizeList) so
 * parents are decoupled from react-window internals.
 *
 * @example
 * const feedRef = useRef<VirtualJobFeedHandle>(null);
 * // After filter change:
 * feedRef.current?.scrollToItem(0);
 */
export const VirtualJobFeed = forwardRef(VirtualJobFeedInner) as <
  T extends VirtualJobFeedItem,
>(
  props: Props<T> & { ref?: React.Ref<VirtualJobFeedHandle> },
) => JSX.Element;
