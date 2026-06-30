import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/theme';

type CommunityUnreadChipProps = {
  count: number;
  size?: 'sm' | 'md';
  accessibilityLabel?: string;
};

/** Red circular unread badge for communities inbox, drawer, and app bar. */
export function CommunityUnreadChip({
  count,
  size = 'md',
  accessibilityLabel,
}: CommunityUnreadChipProps) {
  const { colors, typography } = useTheme();

  if (count <= 0) return null;

  const label = count > 99 ? '99+' : String(count);
  const isSmall = size === 'sm';

  return (
    <View
      accessibilityLabel={accessibilityLabel ?? `${count} unread messages`}
      style={[
        styles.chip,
        isSmall ? styles.chipSm : styles.chipMd,
        { backgroundColor: colors.status.error },
      ]}
    >
      <Text
        style={[
          typography.textPresets.caption,
          styles.text,
          isSmall ? styles.textSm : styles.textMd,
          { color: colors.text.inverse },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSm: {
    borderRadius: 999,
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 5,
  },
  chipMd: {
    borderRadius: 999,
    minHeight: 22,
    minWidth: 22,
    paddingHorizontal: 6,
  },
  text: {
    fontWeight: '800',
    textAlign: 'center',
  },
  textSm: {
    fontSize: 10,
    lineHeight: 12,
  },
  textMd: {
    fontSize: 11,
    lineHeight: 13,
  },
});
