import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonRect } from '@/shared/animations/SkeletonLoader';
import { useTheme, radii } from '@/shared/theme';

/** Portrait hero ratio — matches member HeroClassCard / CoachNowTeachingCard. */
const HERO_SKELETON_HEIGHT_RATIO = (5 / 4) * 0.8;

export function CoachDashboardSkeleton() {
  const { radius, gap, inset } = useTheme();

  return (
    <View style={[styles.root, { gap: gap.lg }]}>
      <View style={{ gap: gap.sm }}>
        <SkeletonRect width="34%" height={12} borderRadius={radii.sm} />
        <SkeletonRect width="72%" height={40} borderRadius={radii.md} />
      </View>

      <SkeletonRect
        height={Math.round((360 - inset.lg * 2) * HERO_SKELETON_HEIGHT_RATIO)}
        borderRadius={radius.cardLarge}
      />

      <View style={styles.scheduleHeader}>
        <SkeletonRect width="48%" height={20} borderRadius={radii.sm} />
        <SkeletonRect width="18%" height={16} borderRadius={radii.sm} />
      </View>

      {Array.from({ length: 3 }).map((_, index) => (
        <View key={index} style={[styles.classCard, { borderRadius: radius.card }]}>
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
  scheduleHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
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
