import React, { memo, useCallback, type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { triggerLightImpact } from '@/shared/haptics';
import { animations } from '@/shared/theme/animations';

type Props = {
  accessibilityLabel: string;
  onPress: () => void;
  children: ReactNode;
  /** When true, row spacing comes from the child card (coach schedule tiles). */
  flush?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ScheduleListRowInner({ accessibilityLabel, onPress, children, flush = false }: Props) {
  const scale = useSharedValue<number>(1);
  const opacity = useSharedValue<number>(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    triggerLightImpact();
    scale.value = withSpring(0.985, animations.spring.snappy);
    opacity.value = withTiming(0.92, animations.timing.press);
  }, [opacity, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animations.spring.snappy);
    opacity.value = withTiming(1, animations.timing.press);
  }, [opacity, scale]);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={accessibilityLabel}
      style={[styles.pressable, flush ? styles.flush : null, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

export const ScheduleListRow = memo(ScheduleListRowInner);

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'stretch',
    marginBottom: 5,
    width: '100%',
  },
  flush: {
    marginBottom: 0,
  },
});
