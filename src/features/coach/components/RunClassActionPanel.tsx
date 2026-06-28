import React, { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HomeAnimatedPressable } from '@/features/home/components/HomeAnimatedPressable';
import { useTheme } from '@/shared/theme';

const ACTION_HEIGHT = 56;

type PrimaryProps = {
  label: string;
  onPress: () => void;
};

export const RunClassPrimaryButton = memo(function RunClassPrimaryButton({ label, onPress }: PrimaryProps) {
  const { colors, typography, radius } = useTheme();
  const handlePress = useCallback(() => onPress(), [onPress]);

  return (
    <HomeAnimatedPressable
      onPress={handlePress}
      accessibilityLabel={label}
      style={[
        styles.primaryButton,
        {
          backgroundColor: colors.accent.default,
          borderRadius: radius.button,
        },
      ]}
    >
      <Text style={[typography.textPresets.bodyStrong, { color: colors.accent.onAccent }]}>{label}</Text>
    </HomeAnimatedPressable>
  );
});

type ScanProps = {
  onPress: () => void;
};

export const RunClassAttendanceHistoryButton = memo(function RunClassAttendanceHistoryButton({
  onPress,
}: ScanProps) {
  const { colors, typography, inset, radius, gap, layout } = useTheme();
  const handlePress = useCallback(() => onPress(), [onPress]);

  return (
    <HomeAnimatedPressable
      onPress={handlePress}
      accessibilityLabel="Attendance history"
      style={[
        styles.scanButton,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderWidth: layout.borderWidth,
          borderRadius: radius.button,
          paddingHorizontal: inset.md,
          gap: gap.md,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: colors.fill.secondary,
            borderRadius: radius.thumbnail,
          },
        ]}
      >
        <Ionicons name="people-outline" size={20} color={colors.text.primary} />
      </View>

      <Text style={[typography.textPresets.bodyStrong, styles.scanLabel, { color: colors.text.primary }]}>
        Attendance history
      </Text>

      <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
    </HomeAnimatedPressable>
  );
});

export const RunClassScanButton = memo(function RunClassScanButton({ onPress }: ScanProps) {
  const { colors, typography, inset, radius, gap, layout } = useTheme();
  const handlePress = useCallback(() => onPress(), [onPress]);

  return (
    <HomeAnimatedPressable
      onPress={handlePress}
      accessibilityLabel="Scan member QR for class attendance"
      style={[
        styles.scanButton,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderWidth: layout.borderWidth,
          borderRadius: radius.button,
          paddingHorizontal: inset.md,
          gap: gap.md,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: colors.fill.secondary,
            borderRadius: radius.thumbnail,
          },
        ]}
      >
        <Ionicons name="qr-code-outline" size={20} color={colors.text.primary} />
      </View>

      <Text style={[typography.textPresets.bodyStrong, styles.scanLabel, { color: colors.text.primary }]}>
        Scan QR
      </Text>

      <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
    </HomeAnimatedPressable>
  );
});

const styles = StyleSheet.create({
  primaryButton: {
    alignItems: 'center',
    height: ACTION_HEIGHT,
    justifyContent: 'center',
    width: '100%',
  },
  scanButton: {
    alignItems: 'center',
    flexDirection: 'row',
    height: ACTION_HEIGHT,
    width: '100%',
  },
  iconWrap: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  scanLabel: {
    flex: 1,
  },
});
