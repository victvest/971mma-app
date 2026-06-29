import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonCircle, SkeletonRect } from '@/shared/animations/SkeletonLoader';
import { useTheme } from '@/shared/theme';

export function CommunityFeedSkeleton() {
  const { inset, gap } = useTheme();

  return (
    <View style={[styles.list, { gap: gap.lg, paddingHorizontal: inset.md, paddingVertical: inset.md }]}>
      <SkeletonRect height={52} borderRadius={16} />
      {Array.from({ length: 3 }).map((_, index) => (
        <View key={index} style={[styles.message, { gap: gap.sm }]}>
          <View style={[styles.row, { gap: gap.sm }]}>
            <SkeletonCircle size={36} />
            <View style={[styles.copy, { gap: gap.xs }]}>
              <SkeletonRect height={10} width="34%" />
              <SkeletonRect height={72} borderRadius={18} />
              <SkeletonRect height={10} width="22%" />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
  },
  message: {
    width: '100%',
  },
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
  },
  copy: {
    flex: 1,
  },
});
