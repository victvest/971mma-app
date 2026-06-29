import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SkeletonCircle, SkeletonRect } from '@/shared/animations/SkeletonLoader';
import { useTheme } from '@/shared/theme';

export function CommunityInboxSkeleton() {
  const { inset, gap } = useTheme();

  return (
    <View style={[styles.list, { gap: gap.sm, paddingVertical: inset.sm }]}>
      {Array.from({ length: 4 }).map((_, index) => (
        <View
          key={index}
          style={[styles.row, { gap: gap.md, paddingHorizontal: inset.lg, paddingVertical: inset.md }]}
        >
          <SkeletonCircle size={48} />
          <View style={[styles.copy, { gap: gap.sm }]}>
            <SkeletonRect height={14} width="62%" />
            <SkeletonRect height={12} width="92%" />
            <SkeletonRect height={12} width="48%" />
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
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  copy: {
    flex: 1,
  },
});
