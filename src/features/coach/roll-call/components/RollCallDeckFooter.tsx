import React, { memo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiPressable } from '@/shared/animations/MotiPressable';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

type Props = {
  disabled?: boolean;
  canUndo?: boolean;
  onUndo: () => void;
};

export const RollCallDeckFooter = memo(function RollCallDeckFooter({
  disabled = false,
  canUndo = false,
  onUndo,
}: Props) {
  const { colors, gap, inset, radius, typography } = useTheme();
  const isDisabled = disabled || !canUndo;

  const handleUndo = () => {
    if (isDisabled) return;
    triggerLightImpact();
    onUndo();
  };

  return (
    <MotiPressable
      onPress={handleUndo}
      disabled={isDisabled}
      accessibilityLabel="Undo last action"
      style={[
        styles.button,
        {
          minHeight: 56,
          borderRadius: radius.pill,
          borderColor: colors.border.default,
          backgroundColor: colors.surface.primary,
          gap: gap.sm,
          opacity: isDisabled ? 0.45 : 1,
          paddingHorizontal: inset.xl,
        },
      ]}
    >
      <Ionicons name="arrow-undo-outline" size={20} color={colors.text.secondary} />
      <Text style={[typography.textPresets.button, { color: colors.text.secondary }]}>
        Undo Last Action
      </Text>
    </MotiPressable>
  );
});

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
