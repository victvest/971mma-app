/** Conservative FlashList item size hints — profiled from row components. */
export const FLASH_LIST_ESTIMATES = {
  attendanceRow: 92,
  classSessionRow: 92,
  scheduleClassCard: 141,
  communityInboxRow: 88,
  communityFeedMessage: 120,
  rollCallRosterRow: 76,
  rollCallSummaryRow: 68,
  rollCallSearchRow: 72,
  coachMemberSearchRow: 88,
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
