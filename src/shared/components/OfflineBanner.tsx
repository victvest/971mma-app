import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOfflineBannerVisible } from '@/shared/hooks/useOfflineBannerVisible';
import { useOfflineReconnect } from '@/shared/hooks/useOfflineReconnect';
import { useTheme, androidStackingLayer } from '@/shared/theme';

export function OfflineBanner() {
  const visible = useOfflineBannerVisible();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { retry, retrying } = useOfflineReconnect();

  if (!visible) return null;

  return (
    <View
      style={[
        styles.shell,
        {
          backgroundColor: colors.status.error,
          paddingTop: insets.top > 0 ? insets.top : 6,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.row}>
        <Text
          style={[typography.textPresets.footnote, styles.message, { color: colors.text.inverse }]}
          numberOfLines={2}
        >
          You are offline. Some features may be unavailable.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry connection"
          accessibilityHint="Checks for network and refreshes data when back online"
          onPress={() => {
            void retry();
          }}
          disabled={retrying}
          hitSlop={8}
          style={({ pressed }) => [
            styles.retryButton,
            {
              borderColor: colors.text.inverse,
              opacity: pressed || retrying ? 0.75 : 1,
            },
          ]}
        >
          {retrying ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <Text style={[typography.textPresets.captionMedium, { color: colors.text.inverse }]}>
              Retry
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    paddingBottom: 6,
    paddingHorizontal: 12,
    zIndex: 2000,
    ...androidStackingLayer(2000),
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  message: {
    flex: 1,
  },
  retryButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
