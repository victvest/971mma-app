import React, { memo, useCallback } from 'react';
import { ScheduleClassCard } from '@/features/schedule/components/ScheduleClassCard';
import { ScheduleListRow } from '@/features/schedule/components/ScheduleListRow';
import type { ClassItem } from '@/types/domain';

type Props = {
  item: ClassItem;
  onPress: () => void;
};

/** Coach home preview row — same shell as member Schedule tab list items. */
export const CoachTodayClassRow = memo(function CoachTodayClassRow({ item, onPress }: Props) {
  const handlePress = useCallback(() => onPress(), [onPress]);

  return (
    <ScheduleListRow accessibilityLabel={item.title} onPress={handlePress}>
      <ScheduleClassCard item={item} embedded />
    </ScheduleListRow>
  );
});
