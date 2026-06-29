import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { formatCommunityDateSeparator } from '@/features/communities/components/community-chat-utils';

type CommunityDateSeparatorProps = {
  iso: string;
};

export function CommunityDateSeparator({ iso }: CommunityDateSeparatorProps) {
  const { colors, typography, radius, inset } = useTheme();
  const label = formatCommunityDateSeparator(iso);

  if (!label) return null;

  return (
    <View style={[styles.row, { paddingVertical: inset.sm }]}>
      <View
        style={[
          styles.pill,
          {
            backgroundColor: colors.fill.secondary,
            borderRadius: radius.pill,
            paddingHorizontal: inset.md,
            paddingVertical: inset.xs,
          },
        ]}
      >
        <Text style={[typography.textPresets.captionMedium, { color: colors.text.tertiary }]}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  pill: {
    alignSelf: 'center',
  },
});
