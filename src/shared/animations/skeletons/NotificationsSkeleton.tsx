import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonRect } from '@/shared/animations/SkeletonLoader';
import { useTheme, radius, radii } from '@/shared/theme';

export function NotificationsSkeleton() {
  const { gap, inset } = useTheme();

  return (
    <View style={[styles.root, { gap: gap.sm }]}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.row,
            {
              borderRadius: radius.card,
              gap: gap.xs,
              paddingHorizontal: inset.md,
              paddingVertical: inset.sm + 2,
            },
          ]}
        >
          <SkeletonRect width="55%" height={15} borderRadius={radii.xs} />
          <SkeletonRect width="80%" height={13} borderRadius={radii.xs} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  row: {
    gap: 6,
  },
});
