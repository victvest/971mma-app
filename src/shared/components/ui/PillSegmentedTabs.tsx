import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';

export type PillSegmentOption<T extends string> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
};

type Props<T extends string> = {
  value: T;
  options: readonly PillSegmentOption<T>[];
  onValueChange: (value: T) => void;
  disabled?: boolean;
  /** `inverse` for check-in; `accent` for brand-green selected pill. */
  selectedVariant?: 'inverse' | 'accent';
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SegmentProps = {
  label: string;
  selected: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
  selectedVariant: 'inverse' | 'accent';
};

function Segment({
  label,
  selected,
  disabled,
  accessibilityLabel,
  onPress,
  selectedVariant,
}: SegmentProps) {
  const { colors, typography, radius, inset } = useTheme();
  const scale = useSharedValue(1);

  const selectedBackground =
    selectedVariant === 'accent' ? colors.accent.default : colors.background.inverse;
  const selectedForeground =
    selectedVariant === 'accent' ? colors.accent.onAccent : colors.text.inverse;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    triggerLightImpact();
    scale.value = withSpring(0.96, animations.spring.snappy);
  }, [disabled, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animations.spring.snappy);
  }, [scale]);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.segment,
        animatedStyle,
        {
          borderRadius: radius.pill,
          backgroundColor: selected ? selectedBackground : 'transparent',
          paddingVertical: inset.sm,
          paddingHorizontal: inset.md,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          typography.textPresets.bodyMedium,
          { color: selected ? selectedForeground : colors.text.secondary },
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export function PillSegmentedTabs<T extends string>({
  value,
  options,
  onValueChange,
  disabled,
  selectedVariant = 'inverse',
}: Props<T>) {
  const { colors, radius, inset } = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.track,
        {
          backgroundColor: colors.fill.secondary,
          borderRadius: radius.pill,
          padding: inset['2xs'],
          borderColor: colors.border.subtle,
          borderWidth: 1,
        },
      ]}
    >
      {options.map((option) => (
        <Segment
          key={option.value}
          label={option.label}
          selected={value === option.value}
          disabled={disabled}
          accessibilityLabel={option.accessibilityLabel ?? option.label}
          onPress={() => onValueChange(option.value)}
          selectedVariant={selectedVariant}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
