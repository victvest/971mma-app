import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

type CommunityGroupsFabProps = {
  onPress: () => void;
  disabled?: boolean;
  bottomOffset?: number;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel?: string;
};

export function CommunityGroupsFab({
  onPress,
  disabled = false,
  bottomOffset = 0,
  icon = 'megaphone',
  accessibilityLabel = 'Post announcement',
}: CommunityGroupsFabProps) {
  const { colors, inset } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: colors.accent.default,
          bottom: inset.lg + bottomOffset,
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          right: inset.lg,
          shadowColor: colors.text.primary,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.accent.onAccent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    alignItems: 'center',
    borderRadius: 999,
    elevation: 6,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    width: 56,
    zIndex: 20,
  },
});
