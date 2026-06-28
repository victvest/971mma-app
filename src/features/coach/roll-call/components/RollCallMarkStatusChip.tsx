import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RollCallMemberMark } from '@/features/coach/roll-call/types';
import { rollCallStatusDisplayLabel } from '@/features/coach/roll-call/types';
import { formatRollCallMarkTime } from '@/features/coach/roll-call/utils/formatRollCallMarkTime';
import { useTheme } from '@/shared/theme';

type Props = {
  mark: RollCallMemberMark;
};

export const RollCallMarkStatusChip = memo(function RollCallMarkStatusChip({ mark }: Props) {
  const { colors, radius, typography, inset } = useTheme();

  const label = useMemo(() => {
    const statusLabel = rollCallStatusDisplayLabel(mark.status);
    if (mark.status === 'late') {
      return `${statusLabel} · ${formatRollCallMarkTime(mark.markedAt)}`;
    }
    if (mark.status === 'left_early') {
      const note = mark.metadata?.left_early_note?.trim();
      return note ? `${statusLabel} · ${note}` : statusLabel;
    }
    return statusLabel;
  }, [mark.markedAt, mark.metadata?.left_early_note, mark.status]);

  const accentColor = useMemo(() => {
    switch (mark.status) {
      case 'present':
        return colors.accent.default;
      case 'absent':
        return colors.status.error;
      case 'late':
        return colors.status.warning;
      default:
        return colors.fill.primary;
    }
  }, [colors, mark.status]);

  return (
    <View
      style={[
        styles.chip,
        {
          borderRadius: radius.pill,
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          paddingHorizontal: inset.sm,
          gap: 6,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <View style={[styles.accentDot, { backgroundColor: accentColor }]} />
      <Text style={[typography.textPresets.captionMedium, styles.label, { color: colors.text.primary }]}>
        {label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 28,
    justifyContent: 'center',
  },
  accentDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  label: {
    fontWeight: '600',
  },
});
