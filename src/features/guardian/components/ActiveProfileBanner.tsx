import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useActiveProfileLabel, useIsViewingChildProfile } from '@/hooks/useActiveMemberId';
import { useTheme } from '@/shared/theme';

export function ActiveProfileBanner() {
  const { colors, typography, radius, layout } = useTheme();
  const label = useActiveProfileLabel();
  const viewingChild = useIsViewingChildProfile();

  if (!viewingChild) return null;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.accent.subtle,
          borderColor: colors.accent.default,
          borderRadius: radius.pill,
          borderWidth: layout.borderWidth,
        },
      ]}
    >
      <Ionicons name="person-circle-outline" size={18} color={colors.accent.default} />
      <Text
        style={[typography.textPresets.bodyStrong, styles.name, { color: colors.accent.default }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    maxWidth: '100%',
  },
  name: {
    flexShrink: 1,
  },
});
