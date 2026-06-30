import React, { useCallback } from 'react';
import { Text, View } from 'react-native';
import { BeltPathRequirementCard } from '@/features/belt/components/BeltPathRequirementCard';
import { BrandedButton } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';
import type { BeltRequirementItem } from '@/types/domain';

type Props = {
  item: BeltRequirementItem;
  trainingDays: number;
  isUpdating: boolean;
  onMarkDone: (requirementId: string) => void;
};

export function CoachRequirementReviewCard({
  item,
  trainingDays,
  isUpdating,
  onMarkDone,
}: Props) {
  const { colors, typography, gap } = useTheme();

  const canMarkDone =
    item.type !== 'attendance' && item.status === 'now' && !isUpdating;

  const handleMarkDone = useCallback(() => {
    onMarkDone(item.id);
  }, [item.id, onMarkDone]);

  return (
    <View style={{ gap: gap.sm }}>
      <BeltPathRequirementCard item={item} trainingDays={trainingDays} />
      {item.type === 'attendance' ? (
        <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>
          Attendance updates automatically from check-ins.
        </Text>
      ) : null}
      {canMarkDone ? (
        <BrandedButton
          label="Mark requirement done"
          variant="secondary"
          full
          loading={isUpdating}
          onPress={handleMarkDone}
        />
      ) : null}
    </View>
  );
}
