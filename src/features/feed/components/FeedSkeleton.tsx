import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonCircle, SkeletonRect } from '@/shared/animations';
import { useTheme } from '@/shared/theme';

export function FeedSkeleton() {
  const { gap, radius } = useTheme();

  return (
    <View style={[styles.wrap, { gap: gap.lg }]}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={[styles.card, { gap: gap.md }]}>
          <View style={[styles.row, { gap: gap.md }]}>
            <SkeletonCircle size={44} />
            <View style={styles.flex}>
              <SkeletonRect height={14} width="44%" borderRadius={8} />
              <SkeletonRect height={12} width="28%" borderRadius={8} style={styles.lineGap} />
            </View>
          </View>
          <SkeletonRect height={14} width="96%" borderRadius={8} />
          <SkeletonRect height={14} width="72%" borderRadius={8} />
          <SkeletonRect height={220} borderRadius={radius.card} />
          <View style={[styles.row, { gap: gap.md }]}>
            <SkeletonRect height={34} width={82} borderRadius={17} />
            <SkeletonRect height={34} width={92} borderRadius={17} />
            <SkeletonRect height={34} width={82} borderRadius={17} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  card: {
    paddingVertical: 12,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  flex: {
    flex: 1,
  },
  lineGap: {
    marginTop: 8,
  },
});
