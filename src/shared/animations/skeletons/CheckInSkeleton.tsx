import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonRect } from '@/shared/animations/SkeletonLoader';
import { useTheme, radii } from '@/shared/theme';

export function CheckInSkeleton() {
  const { radius, gap } = useTheme();

  return (
    <View style={[styles.root, { gap: gap.lg }]}>
      <View style={{ gap: gap.xs }}>
        <SkeletonRect width="35%" height={12} borderRadius={radii.sm} />
        <SkeletonRect width="62%" height={24} borderRadius={radii.md} />
      </View>

      <View style={[styles.qrCard, { borderRadius: radius.cardLarge, gap: gap.lg }]}>
        <View style={[styles.statusRow, { gap: gap.sm }]}>
          <SkeletonRect width={100} height={28} borderRadius={radius.pill} />
          <SkeletonRect width={110} height={28} borderRadius={radius.pill} />
        </View>
        <SkeletonRect width={220} height={220} borderRadius={radii.lg} style={styles.qrBlock} />
        <View style={{ gap: gap.xs, alignItems: 'center' }}>
          <SkeletonRect width="40%" height={12} borderRadius={radii.sm} />
          <SkeletonRect width="55%" height={20} borderRadius={radii.sm} />
        </View>
      </View>

      <View style={[styles.statRow, { gap: gap.sm }]}>
        <View style={[styles.statCard, { borderRadius: radius.card, gap: gap.sm }]}>
          <SkeletonRect width="50%" height={12} borderRadius={radii.sm} />
          <SkeletonRect width="35%" height={28} borderRadius={radii.sm} />
          <SkeletonRect width="80%" height={12} borderRadius={radii.sm} />
        </View>
        <View style={[styles.statCard, { borderRadius: radius.card, gap: gap.sm }]}>
          <SkeletonRect width="60%" height={12} borderRadius={radii.sm} />
          <SkeletonRect width="45%" height={28} borderRadius={radii.sm} />
          <SkeletonRect width="75%" height={12} borderRadius={radii.sm} />
        </View>
      </View>

      <View style={{ gap: gap.sm }}>
        <SkeletonRect width="48%" height={16} borderRadius={radii.sm} />
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonRect key={i} height={52} borderRadius={radius.card} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: 24,
  },
  qrCard: {
    padding: 20,
    alignItems: 'center',
    minHeight: 420,
  },
  statusRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  qrBlock: {
    alignSelf: 'center',
  },
  statRow: {
    flexDirection: 'row',
  },
  statCard: {
    flex: 1,
    padding: 16,
  },
});
