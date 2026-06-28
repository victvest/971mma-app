import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRollCallOfflineQueueStore } from '@/stores/useRollCallOfflineQueueStore';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { useTheme } from '@/shared/theme';

type Props = {
  classId: string;
};

export const RollCallOfflineBanner = memo(function RollCallOfflineBanner({ classId }: Props) {
  const { colors, typography, inset, radius } = useTheme();
  const { isOnline } = useNetworkStatus();
  const pendingCount = useRollCallOfflineQueueStore(
    (state) => state.queue.filter((entry) => entry.classId === classId).length,
  );

  if (isOnline && pendingCount === 0) return null;

  const message = !isOnline
    ? pendingCount > 0
      ? `${pendingCount} mark${pendingCount === 1 ? '' : 's'} saved offline — will sync when you're back online.`
      : 'You are offline. Marks will sync when connection returns.'
    : `Syncing ${pendingCount} queued mark${pendingCount === 1 ? '' : 's'}…`;

  return (
    <View
      style={[
        styles.banner,
        {
          borderRadius: radius.card,
          backgroundColor: colors.status.warningSubtle,
          borderColor: colors.status.warningBorder,
          paddingHorizontal: inset.md,
          paddingVertical: inset.sm,
        },
      ]}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
    >
      <Text style={[typography.textPresets.bodyStrong, { color: colors.status.warning }]}>
        {message}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    width: '100%',
  },
});
