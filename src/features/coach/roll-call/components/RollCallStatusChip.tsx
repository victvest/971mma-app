import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/theme';

export type RollCallStatusChipVariant =
  | 'at_academy'
  | 'no_entry_scan'
  | 'guardian_entry'
  | 'not_on_app'
  | 'booked'
  | 'walk_in';

type ChipSpec = {
  label: string;
  accentColor: string;
};

type Props = {
  variant: RollCallStatusChipVariant;
};

export const RollCallStatusChip = memo(function RollCallStatusChip({ variant }: Props) {
  const { colors, radius, typography, inset } = useTheme();

  const spec = useMemo((): ChipSpec => {
    switch (variant) {
      case 'at_academy':
        return { label: 'At academy today', accentColor: colors.accent.default };
      case 'no_entry_scan':
        return { label: 'No scan', accentColor: colors.status.error };
      case 'guardian_entry':
        return { label: 'Guardian', accentColor: colors.status.error };
      case 'not_on_app':
        return { label: 'Not on app', accentColor: colors.fill.primary };
      case 'booked':
        return { label: 'Booked', accentColor: colors.fill.primary };
      case 'walk_in':
        return { label: 'Walk-in', accentColor: colors.accent.default };
      default:
        return { label: 'Booked', accentColor: colors.fill.primary };
    }
  }, [colors, variant]);

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
      accessibilityLabel={spec.label}
    >
      <View style={[styles.accentDot, { backgroundColor: spec.accentColor }]} />
      <Text style={[typography.textPresets.captionMedium, styles.label, { color: colors.text.primary }]}>
        {spec.label}
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
