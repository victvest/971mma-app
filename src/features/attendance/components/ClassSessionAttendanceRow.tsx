import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isGymToday } from '@/core/time/gymTime';
import {
  rollCallStatusDisplayLabel,
  type RollCallMemberStatus,
} from '@/features/coach/roll-call/types';
import {
  formatAttendanceHeadline,
  formatAttendanceSubtitle,
} from '@/features/checkin/utils/formatAttendance';
import type { ClassSessionAttendanceRow as ClassSessionAttendanceRecord } from '@/services/database/classAttendance.repository';
import { useTheme } from '@/shared/theme';

type Props = {
  item: ClassSessionAttendanceRecord;
  compact?: boolean;
};

function statusSpec(
  status: RollCallMemberStatus,
  colors: ReturnType<typeof useTheme>['colors'],
) {
  switch (status) {
    case 'late':
      return {
        backgroundColor: colors.status.warningSubtle,
        borderColor: colors.status.warningBorder,
        textColor: colors.status.warning,
      };
    case 'present':
      return {
        backgroundColor: colors.status.successSubtle,
        borderColor: colors.status.successBorder,
        textColor: colors.status.success,
      };
    case 'absent':
      return {
        backgroundColor: colors.status.errorSubtle,
        borderColor: colors.status.errorBorder,
        textColor: colors.status.errorEmphasis,
      };
    default:
      return {
        backgroundColor: colors.fill.secondary,
        borderColor: colors.border.default,
        textColor: colors.text.secondary,
      };
  }
}

export const ClassSessionAttendanceRow = memo(function ClassSessionAttendanceRow({
  item,
  compact = false,
}: Props) {
  const { colors, typography, inset, radius, radii, layout } = useTheme();
  const isToday = isGymToday(item.classStartsAt);
  const headline = item.classTitle;
  const subtitle = useMemo(() => {
    const dateLine = formatAttendanceHeadline(item.classStartsAt);
    const timeLine = formatAttendanceSubtitle(item.classStartsAt);
    return `${dateLine} · ${timeLine}`;
  }, [item.classStartsAt]);
  const statusLabel = rollCallStatusDisplayLabel(item.status);
  const badge = useMemo(() => statusSpec(item.status, colors), [colors, item.status]);

  return (
    <View
      style={[
        styles.row,
        {
          paddingHorizontal: inset.md,
          paddingVertical: compact ? inset.sm + 2 : inset.md,
          borderRadius: radius.card,
          backgroundColor: colors.background.elevated,
          borderColor: isToday ? colors.accent.default : colors.border.subtle,
          borderWidth: isToday ? layout.borderWidth + 0.5 : layout.borderWidth,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            borderRadius: radii.md,
            backgroundColor: isToday ? colors.accent.subtle : colors.background.secondary,
          },
        ]}
      >
        <Ionicons
          name={isToday ? 'school' : 'calendar-outline'}
          size={compact ? 18 : 20}
          color={isToday ? colors.accent.default : colors.text.secondary}
        />
      </View>

      <View style={styles.textBlock}>
        <Text
          style={[
            compact ? typography.textPresets.bodyStrong : typography.textPresets.subtitle,
            { color: colors.text.primary },
          ]}
          numberOfLines={1}
        >
          {headline}
        </Text>
        <Text style={[styles.subtitle, { color: colors.text.tertiary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <View
        style={[
          styles.statusBadge,
          {
            borderRadius: radius.pill,
            backgroundColor: badge.backgroundColor,
            borderColor: badge.borderColor,
          },
        ]}
      >
        <Text style={[styles.statusText, { color: badge.textColor }]} numberOfLines={1}>
          {statusLabel}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 120,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
