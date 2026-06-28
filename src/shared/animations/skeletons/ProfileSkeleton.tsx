import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonCircle, SkeletonRect } from '@/shared/animations/SkeletonLoader';
import { useTheme, radii } from '@/shared/theme';

export function ProfileSkeleton() {
  const { radius, gap } = useTheme();

  return (
    <View style={[styles.root, { gap: gap.lg }]}>
      <View style={[styles.heroCard, { borderRadius: radius.cardLarge, gap: gap.md }]}>
        <View style={[styles.heroRow, { gap: gap.md }]}>
          <SkeletonCircle size={60} />
          <View style={{ flex: 1, gap: gap.sm }}>
            <SkeletonRect width="50%" height={12} borderRadius={radii.sm} />
            <SkeletonRect width="75%" height={24} borderRadius={radii.sm} />
            <SkeletonRect width="40%" height={14} borderRadius={radii.sm} />
            <SkeletonRect width="60%" height={12} borderRadius={radii.sm} />
          </View>
        </View>
      </View>

      <View style={{ gap: gap.sm }}>
        <View style={[styles.gridRow, { gap: gap.sm }]}>
          <View style={[styles.gridCard, { borderRadius: radius.cardLarge, gap: gap.sm }]}>
            <SkeletonRect width="45%" height={28} borderRadius={radii.sm} />
            <SkeletonRect width="60%" height={12} borderRadius={radii.sm} />
          </View>
          <View style={[styles.gridCard, { borderRadius: radius.cardLarge, gap: gap.sm }]}>
            <SkeletonRect width="45%" height={28} borderRadius={radii.sm} />
            <SkeletonRect width="55%" height={12} borderRadius={radii.sm} />
          </View>
        </View>
        <View style={[styles.gridRow, { gap: gap.sm }]}>
          <View style={[styles.gridCard, { borderRadius: radius.cardLarge, gap: gap.sm }]}>
            <SkeletonRect width="50%" height={28} borderRadius={radii.sm} />
            <SkeletonRect width="65%" height={12} borderRadius={radii.sm} />
          </View>
          <View style={[styles.gridCard, { borderRadius: radius.cardLarge, gap: gap.sm }]}>
            <SkeletonRect width="40%" height={28} borderRadius={radii.sm} />
            <SkeletonRect width="50%" height={12} borderRadius={radii.sm} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: 24,
  },
  heroCard: {
    height: 200,
    justifyContent: 'flex-end',
    padding: 20,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridRow: {
    flexDirection: 'row',
  },
  gridCard: {
    flex: 1,
    padding: 16,
  },
});
