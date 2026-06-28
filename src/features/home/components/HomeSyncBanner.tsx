import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { HomeAnimatedPressable } from '@/features/home/components/HomeAnimatedPressable';
import { useTheme } from '@/shared/theme';

type Props = {
  onRetry: () => void;
};

export const HomeSyncBanner = memo(function HomeSyncBanner({ onRetry }: Props) {
  const { colors, inset, radius, typography, layout } = useTheme();

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.status.errorSubtle,
          borderColor: colors.status.errorBorder,
          borderWidth: layout.borderWidth,
          borderRadius: radius.card,
          paddingHorizontal: inset.md,
          paddingVertical: inset.sm,
        },
      ]}
    >
      <AlertCircle size={18} color={colors.status.errorEmphasis} strokeWidth={2.25} />
      <View style={styles.copy}>
        <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
          Sync issue
        </Text>
        <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
          Some metrics could not be refreshed.
        </Text>
      </View>
      <HomeAnimatedPressable
        onPress={onRetry}
        accessibilityLabel="Retry sync"
        style={[
          styles.retry,
          {
            borderRadius: radius.button,
            borderColor: colors.status.errorBorder,
            borderWidth: layout.borderWidth,
          },
        ]}
      >
        <Text style={[typography.textPresets.buttonSmall, { color: colors.status.errorEmphasis }]}>
          Retry
        </Text>
      </HomeAnimatedPressable>
    </View>
  );
});

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  retry: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});
