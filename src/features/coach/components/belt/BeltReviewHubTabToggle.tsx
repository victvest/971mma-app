import React, { useMemo } from 'react';
import { PillSegmentedTabs } from '@/shared/components/ui/PillSegmentedTabs';

export type BeltReviewHubTab = 'on-mat' | 'ready' | 'scanned';

type Props = {
  tab: BeltReviewHubTab;
  onTabChange: (tab: BeltReviewHubTab) => void;
  signedInCount: number;
  readyCount: number;
  scannedCount: number;
  disabled?: boolean;
};

export function BeltReviewHubTabToggle({
  tab,
  onTabChange,
  signedInCount,
  readyCount,
  scannedCount,
  disabled,
}: Props) {
  const options = useMemo(
    () =>
      [
        {
          value: 'on-mat' as const,
          label: signedInCount > 0 ? `On mat (${signedInCount})` : 'On mat',
          accessibilityLabel: 'On mat — members signed in today',
        },
        {
          value: 'ready' as const,
          label: readyCount > 0 ? `Ready (${readyCount})` : 'Ready to promote',
          accessibilityLabel: 'Ready to promote — members at promotion readiness',
        },
        {
          value: 'scanned' as const,
          label: scannedCount > 0 ? `Members (${scannedCount})` : 'Members',
          accessibilityLabel: 'Members — members on all roll call lists',
        },
      ] as const,
    [readyCount, signedInCount, scannedCount],
  );

  return (
    <PillSegmentedTabs
      value={tab}
      options={options}
      onValueChange={onTabChange}
      disabled={disabled}
      selectedVariant="accent"
    />
  );
}
