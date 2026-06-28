import React, { memo, useEffect, type ReactNode } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';

/** ScheduleClassCard height (136) + ScheduleListRow marginBottom (5) */
export const SCHEDULE_ITEM_HEIGHT = 141;

const STAGGER_CYCLE = 6;
const STAGGER_MS = 60;
const MOUNT_TRANSLATE = 36;
const MOUNT_FADE_MS = 320;

export type ScrollRevealProps = {
  itemId: string;
  index: number;
  /** @deprecated No longer used — scroll dimming removed. */
  scrollY?: SharedValue<number>;
  /** @deprecated No longer used — scroll dimming removed. */
  topOffset?: SharedValue<number>;
  /** @deprecated No longer used — scroll dimming removed. */
  screenHeight?: number;
  replayKey?: number;
  /** UI-thread tab refocus signal — avoids FlashList `renderItem` identity churn. */
  entranceSignal?: SharedValue<number>;
  /** @deprecated No longer used — scroll dimming removed. */
  itemStride?: number;
  /** @deprecated No longer used — scroll dimming removed. */
  topCleanZone?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

function runScrollRevealMount(
  mountOpacity: SharedValue<number>,
  mountTranslateY: SharedValue<number>,
  index: number,
) {
  'worklet';
  cancelAnimation(mountOpacity);
  cancelAnimation(mountTranslateY);
  mountOpacity.value = 0;
  mountTranslateY.value = 44;

  const delay = (index % STAGGER_CYCLE) * STAGGER_MS;
  mountOpacity.value = withDelay(
    delay,
    withTiming(1, { duration: MOUNT_FADE_MS, easing: Easing.out(Easing.cubic) }),
  );
  mountTranslateY.value = withDelay(
    delay,
    withSpring(0, { damping: 22, stiffness: 180, mass: 0.7, overshootClamping: false }),
  );
}

export const ScrollRevealCard = memo(function ScrollRevealCard({
  itemId,
  index,
  replayKey = 0,
  entranceSignal,
  children,
  style,
}: ScrollRevealProps) {
  const mountOpacity = useSharedValue<number>(0);
  const mountTranslateY = useSharedValue<number>(MOUNT_TRANSLATE);

  useEffect(() => {
    runScrollRevealMount(mountOpacity, mountTranslateY, index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  useEffect(() => {
    if (entranceSignal) return;
    runScrollRevealMount(mountOpacity, mountTranslateY, index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey]);

  useAnimatedReaction(
    () => entranceSignal?.value ?? null,
    (current, previous) => {
      if (current === null || previous === null || current === previous) return;
      runScrollRevealMount(mountOpacity, mountTranslateY, index);
    },
    [entranceSignal, index],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: mountOpacity.value,
    transform: [{ translateY: mountTranslateY.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
});

/** @deprecated No-op kept for backwards compatibility during transition. */
export function triggerReveal(_itemId: string): void {}
