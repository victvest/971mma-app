import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiPressable } from '@/shared/animations/MotiPressable';
import { useTheme } from '@/shared/theme';

type Props = {
  label: string;
  subtitle?: string;
  onPress: () => void;
  showChevron?: boolean;
};

export function NavRow({ label, subtitle, onPress, showChevron = true }: Props) {
  const { colors, typography } = useTheme();

  return (
    <MotiPressable
      onPress={onPress}
      accessibilityLabel={label}
      style={[
        styles.row,
        {
          backgroundColor: colors.background.secondary,
          borderColor: colors.border.subtle,
        },
      ]}
    >
      <View style={styles.textCol}>
        <Text style={[typography.textPresets.body, { color: colors.text.primary }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {showChevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      ) : null}
    </MotiPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textCol: {
    flex: 1,
    gap: 2,
    paddingRight: 8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
});
