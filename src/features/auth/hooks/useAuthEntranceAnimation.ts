import { useEffect } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import { useTheme } from '@/shared/theme';

type AuthEntranceOptions = {
  delay?: number;
  offset?: number;
};

export function useAuthEntranceAnimation(options: AuthEntranceOptions = {}) {
  const { animations, layout } = useTheme();
  const delay = options.delay ?? 0;
  const offset = options.offset ?? layout.authEntranceOffset;
  const opacity = useSharedValue<number>(animations.alpha.hidden);
  const translateY = useSharedValue<number>(offset);
  const visibleAlpha = animations.alpha.visible;
  const idleState = animations.interactionState.idle;

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(visibleAlpha, animations.timing.page));
    translateY.value = withDelay(delay, withSpring(idleState, animations.spring.slow));
  }, [
    animations.spring.slow,
    animations.timing.page,
    delay,
    idleState,
    offset,
    opacity,
    translateY,
    visibleAlpha,
  ]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return style;
}

export function useAuthSlideUpAnimation(options: AuthEntranceOptions = {}) {
  const { animations, layout } = useTheme();
  const delay = options.delay ?? 0;
  const offset = options.offset ?? layout.authEntranceOffset;
  const opacity = useSharedValue<number>(animations.alpha.hidden);
  const translateY = useSharedValue<number>(offset);
  const visibleAlpha = animations.alpha.visible;
  const idleState = animations.interactionState.idle;

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(visibleAlpha, animations.timing.page));
    translateY.value = withDelay(delay, withSpring(idleState, animations.spring.gentle));
  }, [
    animations.spring.gentle,
    animations.timing.page,
    delay,
    idleState,
    offset,
    opacity,
    translateY,
    visibleAlpha,
  ]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return style;
}

export type AuthEntranceStyle = AnimatedStyle<{ opacity: number; transform: { translateY: number }[] }>;
