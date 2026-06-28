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

export type CheckInMode = 'pass' | 'scan';

type Props = {
  mode: CheckInMode;
  onModeChange: (mode: CheckInMode) => void;
  disabled?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SegmentProps = {
  label: string;
  selected: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
};

function Segment({ label, selected, disabled, accessibilityLabel, onPress }: SegmentProps) {
  const { colors, typography, radius, inset } = useTheme();
  const scale = useSharedValue(1);

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
          backgroundColor: selected ? colors.background.inverse : 'transparent',
          paddingVertical: inset.sm,
          paddingHorizontal: inset.md,
        },
      ]}
    >
      <Text
        style={[
          typography.textPresets.bodyMedium,
          { color: selected ? colors.text.inverse : colors.text.secondary },
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export function CheckInModeToggle({ mode, onModeChange, disabled }: Props) {
  const { colors, radius, inset } = useTheme();

  const selectPass = useCallback(() => onModeChange('pass'), [onModeChange]);
  const selectScan = useCallback(() => onModeChange('scan'), [onModeChange]);

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
      <Segment
        label="My pass"
        selected={mode === 'pass'}
        disabled={disabled}
        accessibilityLabel="My pass — show your member QR code"
        onPress={selectPass}
      />
      <Segment
        label="Scan entrance"
        selected={mode === 'scan'}
        disabled={disabled}
        accessibilityLabel="Scan entrance — scan the QR code at the gym entrance"
        onPress={selectScan}
      />
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
