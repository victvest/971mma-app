import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonRect } from '@/shared/animations/SkeletonLoader';
import { useTheme, radii } from '@/shared/theme';

export function RewardsSkeleton() {
  const { radius, gap } = useTheme();

  return (
    <View style={[styles.root, { gap: gap.lg }]}>
      <View style={[styles.pointsCard, { borderRadius: radius.cardLarge, gap: gap.md }]}>
        <View style={styles.pointsHeader}>
          <SkeletonRect width="45%" height={12} borderRadius={radii.sm} />
          <SkeletonRect width={72} height={24} borderRadius={radius.pill} />
        </View>
        <SkeletonRect width="55%" height={40} borderRadius={radii.md} />
        <SkeletonRect width="38%" height={14} borderRadius={radii.sm} />
      </View>

      <SkeletonRect width="52%" height={22} borderRadius={radii.sm} />

      <View style={[styles.challengeRow, { gap: gap.md }]}>
        <View style={[styles.challengeCard, { borderRadius: radius.cardLarge, gap: gap.md }]}>
          <SkeletonRect width={48} height={48} borderRadius={radii.full} />
          <SkeletonRect width="80%" height={16} borderRadius={radii.sm} />
          <SkeletonRect width="60%" height={12} borderRadius={radii.sm} />
          <SkeletonRect width="100%" height={5} borderRadius={radius.pill} />
        </View>
        <View style={[styles.challengeCard, { borderRadius: radius.cardLarge, gap: gap.md }]}>
          <SkeletonRect width={48} height={48} borderRadius={radii.full} />
          <SkeletonRect width="80%" height={16} borderRadius={radii.sm} />
          <SkeletonRect width="60%" height={12} borderRadius={radii.sm} />
          <SkeletonRect width="100%" height={5} borderRadius={radius.pill} />
        </View>
      </View>

      <SkeletonRect width="48%" height={22} borderRadius={radii.sm} />

      <View style={[styles.catalogRow, { gap: gap.md }]}>
        <View style={[styles.catalogCard, { borderRadius: radius.cardLarge, gap: gap.sm }]}>
          <SkeletonRect width="100%" height={140} borderRadius={radius.card} />
          <SkeletonRect width="85%" height={16} borderRadius={radii.sm} />
          <SkeletonRect width="55%" height={14} borderRadius={radii.sm} />
          <SkeletonRect width="100%" height={44} borderRadius={radius.pill} />
        </View>
        <View style={[styles.catalogCard, { borderRadius: radius.cardLarge, gap: gap.sm }]}>
          <SkeletonRect width="100%" height={140} borderRadius={radius.card} />
          <SkeletonRect width="85%" height={16} borderRadius={radii.sm} />
          <SkeletonRect width="55%" height={14} borderRadius={radii.sm} />
          <SkeletonRect width="100%" height={44} borderRadius={radius.pill} />
        </View>
      </View>

      <RewardsMilestonesSkeleton />
    </View>
  );
}

export function RewardsMilestonesSkeleton() {
  const { radius, gap } = useTheme();

  return (
    <View style={{ gap: gap.md }}>
      <SkeletonRect width="52%" height={18} borderRadius={radii.sm} />
      {Array.from({ length: 3 }).map((_, i) => (
        <View
          key={i}
          style={[styles.milestoneRow, { borderRadius: radius.card, gap: gap.md }]}
        >
          <SkeletonRect width={40} height={40} borderRadius={radii.md} />
          <View style={{ flex: 1, gap: gap.sm }}>
            <SkeletonRect width="70%" height={16} borderRadius={radii.sm} />
            <SkeletonRect width="100%" height={6} borderRadius={radius.pill} />
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
  pointsCard: {
    padding: 16,
  },
  pointsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  challengeRow: {
    flexDirection: 'row',
  },
  challengeCard: {
    padding: 16,
    width: 280,
  },
  catalogRow: {
    flexDirection: 'row',
  },
  catalogCard: {
    flex: 1,
    padding: 12,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
});
