/** Conservative FlashList item size hints — profiled from row components. */
export const FLASH_LIST_ESTIMATES = {
  attendanceRow: 92,
  attendanceMonthHeader: 36,
  classSessionRow: 92,
  scheduleClassCard: 141,
  rollCallRosterRow: 76,
  rollCallMemberRow: 96,
  rollCallSummaryRow: 96,
  rollCallSearchRow: 72,
  coachMemberSearchRow: 88,
  feedPostCard: 300,
} as const;

type FlashListLayout = { span?: number; size?: number };

const overrideLayoutBySize = new Map<number, (layout: FlashListLayout) => void>();

/** FlashList v2 `overrideItemLayout` helper — replaces v1 `estimatedItemSize`. */
export function flashListOverrideItemLayout(estimatedSize: number) {
  let callback = overrideLayoutBySize.get(estimatedSize);
  if (!callback) {
    callback = (layout) => {
      layout.size = estimatedSize;
    };
    overrideLayoutBySize.set(estimatedSize, callback);
  }
  return callback;
}
