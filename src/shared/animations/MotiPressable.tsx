import React, { useCallback, type ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { animations } from '@/shared/theme/animations';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none';
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  testID?: string;
  scaleTo?: number;
  pressOpacity?: number;
  transition?: unknown;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MotiPressable({
  children,
  onPress,
  disabled,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  testID,
  scaleTo = animations.scale.pressed,
  pressOpacity = 0.9,
}: Props) {
  const scale = useSharedValue<number>(1);
  const opacity = useSharedValue<number>(1);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    scale.value = withSpring(scaleTo, animations.spring.snappy);
    opacity.value = withTiming(pressOpacity, animations.timing.press);
  }, [disabled, opacity, pressOpacity, scale, scaleTo]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animations.spring.snappy);
    opacity.value = withTiming(1, animations.timing.press);
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      testID={testID}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
