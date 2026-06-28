import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/theme';

export type BeltPathBadgeStatus =
  | 'in_progress'
  | 'done'
  | 'locked'
  | 'joined'
  | 'completed';

type Props = {
  status: BeltPathBadgeStatus;
};

function getBadgeCopy(status: BeltPathBadgeStatus): string {
  switch (status) {
    case 'in_progress':
      return 'IN PROGRESS';
    case 'done':
      return 'DONE';
    case 'locked':
      return 'LOCKED';
    case 'joined':
      return 'JOINED';
    case 'completed':
      return 'COMPLETED';
    default:
      return status;
  }
}

export function BeltPathStatusBadge({ status }: Props) {
  const { colors } = useTheme();

  const isActive =
    status === 'in_progress' || status === 'done' || status === 'joined' || status === 'completed';

  const backgroundColor =
    status === 'in_progress' || status === 'joined'
      ? colors.accent.default
      : status === 'done' || status === 'completed'
        ? colors.status.success
        : colors.fill.secondary;

  const textColor =
    isActive ? colors.text.onAccent : colors.text.tertiary;

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.label, { color: textColor }]}>{getBadgeCopy(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
