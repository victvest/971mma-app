import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonCircle, SkeletonRect } from '@/shared/animations/SkeletonLoader';
import { useTheme, radii } from '@/shared/theme';

export function HomeDashboardSkeleton() {
  const { radius, gap, inset } = useTheme();

  return (
    <View style={[styles.root, { gap: gap.lg }]}>
      <View style={{ gap: gap.sm }}>
        <SkeletonRect width="38%" height={12} borderRadius={radii.sm} />
        <SkeletonRect width="72%" height={40} borderRadius={radii.md} />
      </View>

      <SkeletonRect height={228} borderRadius={radius.card} />

      <View style={[styles.disciplineCard, { borderRadius: radius.card, gap: gap.md, padding: inset.md }]}>
        <SkeletonRect width="32%" height={12} borderRadius={radii.sm} />
        <View style={styles.disciplineRow}>
          <View style={{ flex: 1, gap: gap.sm }}>
            <SkeletonRect width="45%" height={36} borderRadius={radii.sm} />
            <SkeletonRect width="55%" height={14} borderRadius={radii.sm} />
          </View>
          <SkeletonCircle size={64} />
        </View>
        <View style={[styles.weekRow, { gap: gap.xs }]}>
          {Array.from({ length: 7 }).map((_, i) => (
            <SkeletonRect key={i} width={18} height={28} borderRadius={radii.sm} />
          ))}
        </View>
      </View>

      <View style={[styles.actionsRow, { gap: gap.sm }]}>
        <View style={[styles.actionTile, { borderRadius: radius.card, gap: gap.sm }]}>
          <SkeletonCircle size={40} />
          <SkeletonRect width="70%" height={18} borderRadius={radii.sm} />
          <SkeletonRect width="55%" height={12} borderRadius={radii.sm} />
        </View>
        <View style={[styles.actionTile, { borderRadius: radius.card, gap: gap.sm }]}>
          <SkeletonCircle size={40} />
          <SkeletonRect width="60%" height={24} borderRadius={radii.sm} />
          <SkeletonRect width="50%" height={12} borderRadius={radii.sm} />
        </View>
      </View>

      <View style={[styles.beltCard, { borderRadius: radius.card, gap: gap.md, padding: inset.md }]}>
        <View style={styles.beltRow}>
          <View style={{ flex: 1, gap: gap.sm }}>
            <SkeletonRect width="35%" height={12} borderRadius={radii.sm} />
            <SkeletonRect width="70%" height={22} borderRadius={radii.sm} />
            <SkeletonRect width="85%" height={14} borderRadius={radii.sm} />
          </View>
          <SkeletonCircle size={52} />
        </View>
      </View>

      <SkeletonRect width="42%" height={20} borderRadius={radii.sm} />

      <View style={[styles.coachRow, { gap: gap.sm }]}>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonRect key={i} width={132} height={176} borderRadius={radius.card} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  actionTile: {
    flex: 1,
    padding: 16,
  },
  disciplineCard: {},
  disciplineRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  beltCard: {},
  beltRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  coachRow: {
    flexDirection: 'row',
  },
});
