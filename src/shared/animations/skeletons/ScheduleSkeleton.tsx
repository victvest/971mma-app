import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonRect } from '@/shared/animations/SkeletonLoader';
import { useTheme, radii } from '@/shared/theme';

type Props = {
  showHeader?: boolean;
  showFilters?: boolean;
};

export function ScheduleSkeleton({ showHeader = true, showFilters = true }: Props) {
  const { radius, gap } = useTheme();

  return (
    <View style={[styles.root, { gap: gap.md }]}>
      {showHeader ? (
        <View style={{ gap: gap.sm }}>
          <SkeletonRect width="42%" height={18} borderRadius={radii.sm} />
          <SkeletonRect width="100%" height={12} borderRadius={radii.sm} />
        </View>
      ) : null}

      {showFilters ? (
        <View style={[styles.filterRow, { gap: gap.sm }]}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRect key={i} width={88} height={36} borderRadius={radius.pill} />
          ))}
        </View>
      ) : null}

      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} style={[styles.classCard, { borderRadius: radius.card }]}>
          <SkeletonRect width={132} height={136} borderRadius={0} />
          <View style={[styles.classCardBody, { gap: gap.sm }]}>
            <SkeletonRect width="65%" height={16} borderRadius={radii.sm} />
            <SkeletonRect width="45%" height={12} borderRadius={radii.sm} />
            <SkeletonRect width="55%" height={12} borderRadius={radii.sm} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: 24,
  },
  filterRow: {
    flexDirection: 'row',
  },
  classCard: {
    flexDirection: 'row',
    height: 136,
    overflow: 'hidden',
  },
  classCardBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
});
