import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { MotiPressable } from '@/shared/animations/MotiPressable';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

export type ChipTone = 'accent' | 'error' | 'neutral' | 'ink';

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: ChipTone;
};

export function Chip({ label, active = false, onPress, tone = 'accent' }: Props) {
  const { colors, radius } = useTheme();

  const { activeBg, activeFg, idleFg } = useMemo(() => {
    switch (tone) {
      case 'error':
        return {
          activeBg: colors.status.error,
          activeFg: colors.text.inverse,
          idleFg: colors.text.secondary,
        };
      case 'neutral':
        return {
          activeBg: colors.fill.primary,
          activeFg: colors.text.inverse,
          idleFg: colors.text.secondary,
        };
      case 'ink':
        return {
          activeBg: colors.text.primary,
          activeFg: colors.text.inverse,
          idleFg: colors.text.secondary,
        };
      default:
        return {
          activeBg: colors.accent.default,
          activeFg: colors.accent.onAccent,
          idleFg: colors.text.secondary,
        };
    }
  }, [tone, colors]);

  return (
    <MotiPressable
      onPress={
        onPress
          ? () => {
              triggerSelectionHaptic();
              onPress();
            }
          : undefined
      }
      accessibilityLabel={label}
      style={[
        styles.base,
        {
          borderRadius: radius.pill,
          backgroundColor: active ? activeBg : colors.surface.primary,
          borderColor: active ? activeBg : colors.border.default,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: active ? activeFg : idleFg },
        ]}
      >
        {label}
      </Text>
    </MotiPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 38,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
