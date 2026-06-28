import React, { memo, useCallback, type ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { triggerLightImpact } from '@/shared/haptics';
import { animations } from '@/shared/theme/animations';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none';
  scaleTo?: number;
  pressOpacity?: number;
  haptics?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const HomeAnimatedPressable = memo(function HomeAnimatedPressable({
  children,
  onPress,
  disabled = false,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  scaleTo = 0.98,
  pressOpacity = 0.9,
  haptics = true,
}: Props) {
  const scale = useSharedValue<number>(1);
  const opacity = useSharedValue<number>(1);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    if (haptics) {
      triggerLightImpact();
    }
    scale.value = withSpring(scaleTo, animations.spring.snappy);
    opacity.value = withTiming(pressOpacity, animations.timing.press);
  }, [disabled, haptics, opacity, pressOpacity, scale, scaleTo]);

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
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
});
