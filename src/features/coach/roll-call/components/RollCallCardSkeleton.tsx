import React, { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SkeletonRect } from '@/shared/animations/SkeletonLoader';
import { useTheme } from '@/shared/theme';

type Props = {
  style?: StyleProp<ViewStyle>;
};

export const RollCallCardSkeleton = memo(function RollCallCardSkeleton({ style }: Props) {
  const { colors, inset, radius, gap, radii: radiiTokens } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: radiiTokens.lg,
          backgroundColor: colors.surface.secondary,
        },
        style,
      ]}
      accessibilityLabel="Loading member card"
      accessibilityRole="progressbar"
    >
      <View style={StyleSheet.absoluteFill}>
        <SkeletonRect width="100%" height={280} borderRadius={0} />
      </View>

      <View style={[styles.chipOverlay, { padding: inset.md, gap: gap.xs }]}>
        <SkeletonRect width={132} height={32} borderRadius={radius.pill} />
        <SkeletonRect width={96} height={32} borderRadius={radius.pill} />
      </View>

      <View style={[styles.footer, { padding: inset.lg, gap: gap.sm }]}>
        <SkeletonRect width="72%" height={36} borderRadius={radius.tag} />
        <SkeletonRect width="48%" height={18} borderRadius={radius.tag} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    overflow: 'hidden',
  },
  chipOverlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  footer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
