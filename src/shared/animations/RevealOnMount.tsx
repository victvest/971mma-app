import React, { memo, useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  /** Stagger delay in ms before this section animates in. */
  delay?: number;
  /** Vertical travel distance in px (default 18). */
  distance?: number;
  /** Replay trigger — change the value to re-run the entrance. */
  replayKey?: number | string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Lightweight, UI-thread mount entrance: fade + spring lift.
 * Shared across static/detail screens so section reveals feel identical app-wide.
 */
export const RevealOnMount = memo(function RevealOnMount({
  delay = 0,
  distance = 18,
  replayKey = 0,
  style,
  children,
}: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }),
    );
    // progress is a stable Reanimated ref — intentionally omitted from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, replayKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
});
