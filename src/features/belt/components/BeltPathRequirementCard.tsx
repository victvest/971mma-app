import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BeltPathIconBadge } from '@/features/belt/components/BeltPathIconBadge';
import { BeltPathStatusBadge, type BeltPathBadgeStatus } from '@/features/belt/components/BeltPathStatusBadge';
import { useTheme } from '@/shared/theme';
import type { BeltRequirementItem } from '@/types/domain';

type Props = {
  item: BeltRequirementItem;
  trainingDays: number;
};

function mapRequirementStatus(status: BeltRequirementItem['status']): BeltPathBadgeStatus {
  if (status === 'now') return 'in_progress';
  if (status === 'done') return 'done';
  return 'locked';
}

function getRequirementIcon(type: BeltRequirementItem['type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'attendance':
      return 'school-outline';
    case 'skill':
      return 'body-outline';
    case 'assessment':
      return 'checkmark-done-outline';
    default:
      return 'ellipse-outline';
  }
}

function getMetaLine(item: BeltRequirementItem, trainingDays: number): string {
  if (item.type === 'attendance' && item.attendanceTarget) {
    const current = Math.min(trainingDays, item.attendanceTarget);
    return `Stripe ${item.stripe} · Progress: ${current}/${item.attendanceTarget}`;
  }
  return `Stripe ${item.stripe}`;
}

export const BeltPathRequirementCard = React.memo(function BeltPathRequirementCard({
  item,
  trainingDays,
}: Props) {
  const { colors, typography, radius, shadows, inset, gap } = useTheme();
  const badgeStatus = mapRequirementStatus(item.status);
  const isActive = item.status === 'now' || item.status === 'done';
  const iconName = getRequirementIcon(item.type);
  const iconColor = isActive ? colors.accent.default : colors.text.tertiary;

  return (
    <View
      style={[
        styles.card,
        shadows.card,
        {
          backgroundColor: colors.surface.primary,
          borderRadius: radius.cardLarge,
          padding: inset.md,
          gap: gap.md,
        },
      ]}
    >
      <View style={styles.row}>
        <BeltPathIconBadge active={isActive}>
          <Ionicons name={iconName} size={20} color={iconColor} />
        </BeltPathIconBadge>

        <View style={[styles.copy, { gap: 2 }]}>
          <Text
            style={[
              typography.textPresets.bodyStrong,
              { color: isActive ? colors.text.primary : colors.text.secondary },
            ]}
          >
            {item.title}
          </Text>
          <Text style={[typography.textPresets.footnote, { color: colors.text.tertiary }]}>
            {getMetaLine(item, trainingDays)}
          </Text>
        </View>

        <BeltPathStatusBadge status={badgeStatus} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {},
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  copy: {
    flex: 1,
  },
});
