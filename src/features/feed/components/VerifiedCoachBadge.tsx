import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/theme';

type Props = {
  size?: number;
};

export function VerifiedCoachBadge({ size = 17 }: Props) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel="Verified coach"
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.accent.default,
        },
      ]}
    >
      <Ionicons name="checkmark" size={Math.max(11, size - 5)} color={colors.accent.onAccent} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
