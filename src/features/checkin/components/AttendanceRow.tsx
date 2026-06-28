import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isGymToday } from '@/core/time/gymTime';
import {
  formatAttendanceHeadline,
  formatAttendanceSubtitle,
  formatCheckInMethod,
} from '@/features/checkin/utils/formatAttendance';
import { useTheme } from '@/shared/theme';
import type { CheckInRow } from '@/types/database';

type Props = {
  item: CheckInRow;
  compact?: boolean;
};

export const AttendanceRow = memo(function AttendanceRow({ item, compact = false }: Props) {
  const { colors, typography, inset, radius, radii, layout } = useTheme();
  const isToday = isGymToday(item.checked_in_at);
  const timeLabel = formatAttendanceSubtitle(item.checked_in_at);
  const dateLabel = formatAttendanceHeadline(item.checked_in_at);

  const hasClassInfo = !!item.classes;
  const title = item.classes?.title ?? 'Facility Visit';
  const discipline = item.classes?.disciplines?.display_name ?? item.classes?.discipline;
  const coachName = item.classes?.coaches?.name ?? item.classes?.coach_name;
  const duration = item.classes?.duration_minutes;
  const didNotAttend = item.missed === true || item.late_cancelled === true || item.signed_in === false;

  const methodLabel = formatCheckInMethod(item.method);
  const sourceLabel = item.source === 'mindbody' ? 'MB Sync' : 'App';

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
          name={isToday ? 'checkmark-circle' : hasClassInfo ? 'barbell-outline' : 'footsteps-outline'}
          size={compact ? 18 : 20}
          color={
            didNotAttend
              ? colors.status.warning
              : isToday
                ? colors.accent.default
                : colors.text.secondary
          }
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
          {title}
        </Text>
        
        <Text style={[styles.subtitle, { color: colors.text.secondary }]} numberOfLines={1}>
          {dateLabel} at {timeLabel}
        </Text>

        {hasClassInfo && (
          <Text style={[styles.metaText, { color: colors.text.tertiary }]} numberOfLines={1}>
            {discipline}{coachName ? ` · Coach: ${coachName}` : ''}{duration ? ` · ${duration}m` : ''}
          </Text>
        )}

        {didNotAttend ? (
          <Text style={[styles.metaText, { color: colors.status.warning }]} numberOfLines={1}>
            Not counted toward training totals
          </Text>
        ) : null}
      </View>

      <View style={styles.badgeColumn}>
        <View
          style={[
            styles.methodBadge,
            {
              borderRadius: radius.pill,
              backgroundColor: colors.background.secondary,
            },
          ]}
        >
          <Text style={[styles.methodText, { color: colors.text.secondary }]}>{methodLabel}</Text>
        </View>
        <Text style={[styles.sourceText, { color: colors.text.tertiary }]}>{sourceLabel}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
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
  metaText: {
    fontSize: 12,
    lineHeight: 16,
  },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  methodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 96,
  },
  methodText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '500',
  },
});
