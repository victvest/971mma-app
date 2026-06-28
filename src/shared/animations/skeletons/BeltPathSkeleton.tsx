import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonRect } from '@/shared/animations/SkeletonLoader';
import { useTheme, radii } from '@/shared/theme';

export function BeltPathSkeleton() {
  const { radius, gap, inset } = useTheme();

  return (
    <View style={[styles.root, { gap: gap.lg, marginTop: 40 }]}>
      <View
        style={[
          styles.attendanceCard,
          { borderRadius: radius.cardLarge, gap: gap.lg, padding: inset.lg },
        ]}
      >
        <SkeletonRect width="45%" height={18} borderRadius={radii.sm} />
        <View style={[styles.statRow, { gap: gap.lg }]}>
          <SkeletonRect width={80} height={80} borderRadius={radii.full} />
          <View style={{ flex: 1, gap: gap.sm }}>
            <SkeletonRect width="75%" height={16} borderRadius={radii.sm} />
            <SkeletonRect width="55%" height={14} borderRadius={radii.sm} />
            <SkeletonRect width="40%" height={12} borderRadius={radii.sm} />
          </View>
        </View>
        <View style={[styles.weekRow, { gap: gap.xs }]}>
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonRect key={i} width={28} height={48} borderRadius={radii.sm} />
          ))}
        </View>
      </View>

      <SkeletonRect width="50%" height={18} borderRadius={radii.sm} />
      {Array.from({ length: 3 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.rowCard,
            { borderRadius: radius.cardLarge, padding: inset.md, gap: gap.md },
          ]}
        >
          <SkeletonRect width={44} height={44} borderRadius={radii.full} />
          <View style={{ flex: 1, gap: gap.xs }}>
            <SkeletonRect width="70%" height={14} borderRadius={radii.sm} />
            <SkeletonRect width="45%" height={12} borderRadius={radii.sm} />
          </View>
          <SkeletonRect width={72} height={24} borderRadius={radii.full} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: 24,
  },
  attendanceCard: {},
  statRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowCard: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
