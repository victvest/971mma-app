import React, { useCallback, useEffect, type ReactNode } from 'react';
import { type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { animations } from '@/shared/theme/animations';

type Props = {
  index: number;
  scrollY: SharedValue<number>;
  screenHeight: number;
  contentTopOffset: number;
  /** Motion strength multiplier — 1 = standard, >1 = more dramatic. */
  strength?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Mount stagger + reversible viewport reveal used by detail content sheets.
 * As a section travels through the viewport it lifts, scales and fades — and it
 * plays in reverse when scrolled back up, so the motion is always "alive".
 */
export function DetailRevealSection({
  index,
  scrollY,
  screenHeight,
  contentTopOffset,
  strength = 1,
  style,
  children,
}: Props) {
  const sectionY = useSharedValue<number>(0);
  const mount = useSharedValue<number>(0);

  useEffect(() => {
    mount.value = 0;
    mount.value = withDelay(index * animations.stagger.base, withTiming(1, animations.timing.fade));
  }, [index, mount]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      sectionY.value = event.nativeEvent.layout.y;
    },
    [sectionY],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const screenY = contentTopOffset + sectionY.value - scrollY.value;
    const enterLift = 64 * strength;
    const exitLift = -36 * strength;

    const viewportOpacity = interpolate(
      screenY,
      [screenHeight + 120, screenHeight * 0.82, screenHeight * 0.3, -150],
      [0.12, 1, 1, 0.26],
      Extrapolation.CLAMP,
    );
    const lift = interpolate(
      screenY,
      [screenHeight + 120, screenHeight * 0.72, -150],
      [enterLift, 0, exitLift],
      Extrapolation.CLAMP,
    );
    const depthScale = interpolate(
      screenY,
      [screenHeight + 120, screenHeight * 0.72, -150],
      [1 - 0.06 * strength, 1, 1 - 0.015 * strength],
      Extrapolation.CLAMP,
    );

    return {
      opacity: mount.value * viewportOpacity,
      transform: [
        { translateY: lift + (1 - mount.value) * 28 },
        { scale: interpolate(mount.value, [0, 1], [0.97, depthScale], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View onLayout={handleLayout} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
