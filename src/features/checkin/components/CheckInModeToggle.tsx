import React, { useMemo } from 'react';
import { PillSegmentedTabs } from '@/shared/components/ui/PillSegmentedTabs';

export type CheckInMode = 'pass' | 'scan';

type Props = {
  mode: CheckInMode;
  onModeChange: (mode: CheckInMode) => void;
  disabled?: boolean;
};

export function CheckInModeToggle({ mode, onModeChange, disabled }: Props) {
  const options = useMemo(
    () =>
      [
        {
          value: 'pass' as const,
          label: 'My pass',
          accessibilityLabel: 'My pass — show your member QR code',
        },
        {
          value: 'scan' as const,
          label: 'Scan entrance',
          accessibilityLabel: 'Scan entrance — scan the QR code at the gym entrance',
        },
      ] as const,
    [],
  );

  return (
    <PillSegmentedTabs
      value={mode}
      options={options}
      onValueChange={onModeChange}
      disabled={disabled}
    />
  );
}
