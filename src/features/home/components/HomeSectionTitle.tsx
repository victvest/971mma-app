import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HomeAnimatedPressable } from '@/features/home/components/HomeAnimatedPressable';
import { useTheme } from '@/shared/theme';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionAccessibilityLabel?: string;
};

export function HomeSectionTitle({
  title,
  actionLabel,
  onAction,
  actionAccessibilityLabel,
}: Props) {
  const { colors, typography, gap } = useTheme();

  return (
    <View style={[styles.row, { marginBottom: gap.sm }]}>
      <Text style={[typography.textPresets.subtitle, styles.title, { color: colors.text.primary }]}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <HomeAnimatedPressable
          onPress={onAction}
          accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
        >
          <Text style={[typography.textPresets.bodyStrong, { color: colors.accent.default }]}>
            {actionLabel}
          </Text>
        </HomeAnimatedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  title: {
    letterSpacing: -0.2,
  },
});
