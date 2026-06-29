import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedBarFill } from '@/shared/animations';
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
    return `Stripe ${item.stripe} · ${current}/${item.attendanceTarget} classes`;
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

  const attendanceProgress = useMemo(() => {
    if (item.type !== 'attendance' || !item.attendanceTarget) return null;
    const current = Math.min(trainingDays, item.attendanceTarget);
    const percent = Math.round((current / item.attendanceTarget) * 100);
    return { current, target: item.attendanceTarget, percent };
  }, [item.attendanceTarget, item.type, trainingDays]);

  const showDescription = isActive && item.description;

  return (
    <View
      style={[
        styles.card,
        shadows.card,
        {
          backgroundColor: colors.surface.primary,
          borderRadius: radius.cardLarge,
          padding: inset.md,
          gap: gap.sm,
          borderWidth: item.status === 'now' ? 1.5 : 0,
          borderColor: item.status === 'now' ? colors.accent.default : 'transparent',
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

      {showDescription ? (
        <Text style={[typography.textPresets.footnote, { color: colors.text.secondary, lineHeight: 18 }]}>
          {item.description}
        </Text>
      ) : null}

      {attendanceProgress && item.status !== 'locked' ? (
        <View style={[styles.progressBlock, { gap: gap.xs }]}>
          <AnimatedBarFill
            percent={attendanceProgress.percent}
            backgroundColor={colors.accent.pressed}
            highlightColor={colors.accent.default}
            isHighlighted={item.status === 'now'}
            trackColor={colors.accent.subtle}
            trackHeight={6}
            minFillHeight={item.status === 'done' ? 6 : 4}
          />
          <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>
            {item.status === 'done'
              ? 'Attendance requirement complete'
              : `${attendanceProgress.target - attendanceProgress.current} classes to go`}
          </Text>
        </View>
      ) : null}
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
  progressBlock: {
    paddingLeft: 56,
  },
});
