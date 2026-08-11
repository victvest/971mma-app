import React, { memo, useCallback, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { AppScrollView } from '@/shared/components/ui';
import { animations } from '@/shared/theme/animations';

export const AnimatedAppScrollView = Animated.createAnimatedComponent(AppScrollView);

export type HomeSectionMotion = 'default' | 'heroCopy' | 'heroCard';

const SECTION_ENTRANCE_TRANSLATE = 42;
const SECTION_STAGGER_MS = animations.stagger.base;
const SECTION_FADE = animations.timing.fade;
const SECTION_SPRING = animations.spring.gentle;
const SECTION_FAILSAFE_MS = SECTION_STAGGER_MS * 7 + animations.duration.slow + 120;

function runSectionEntrance(
  index: number,
  opacity: SharedValue<number>,
  translateY: SharedValue<number>,
) {
  'worklet';
  const delay = Math.min(index, 7) * SECTION_STAGGER_MS;
  cancelAnimation(opacity);
  cancelAnimation(translateY);
  opacity.value = 0;
  translateY.value = SECTION_ENTRANCE_TRANSLATE;
  opacity.value = withDelay(delay, withTiming(1, SECTION_FADE));
  translateY.value = withDelay(delay, withSpring(0, SECTION_SPRING));
}

type HomeAnimatedSectionProps = {
  children: ReactNode;
  index: number;
  /** UI-thread tab refocus replay for smooth animation restarts. */
  entranceSignal?: SharedValue<number>;
  /** React-state replay key that lets Home schedule a visibility failsafe. */
  replayKey?: number;
  /** @deprecated Scroll-linked motion removed — kept for call-site compatibility. */
  scrollY?: SharedValue<number>;
  /** @deprecated Scroll-linked motion removed — kept for call-site compatibility. */
  screenHeight?: number;
  /** @deprecated Scroll-linked motion removed — kept for call-site compatibility. */
  topCleanZone?: number;
  /** @deprecated Scroll-linked motion removed — kept for call-site compatibility. */
  motion?: HomeSectionMotion;
  style?: StyleProp<ViewStyle>;
};

export const HomeAnimatedSection = memo(function HomeAnimatedSection({
  children,
  index,
  entranceSignal,
  replayKey = 0,
  style,
}: HomeAnimatedSectionProps) {
  const opacity = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(34);
  const latestRun = useSharedValue<number>(0);

  const startEntrance = useCallback(() => {
    latestRun.value += 1;
    runSectionEntrance(index, opacity, translateY);
    return latestRun.value;
  }, [index, latestRun, opacity, translateY]);

  useLayoutEffect(() => {
    if (!entranceSignal) {
      return;
    }

    startEntrance();
  }, [entranceSignal, replayKey, startEntrance]);

  useLayoutEffect(() => {
    if (entranceSignal) {
      return;
    }

    startEntrance();
  }, [entranceSignal, replayKey, startEntrance]);

  useEffect(() => {
    const runId = latestRun.value;
    const timer = setTimeout(() => {
      if (latestRun.value !== runId) return;
      opacity.value = 1;
      translateY.value = 0;
    }, SECTION_FAILSAFE_MS);

    return () => clearTimeout(timer);
  }, [entranceSignal, index, latestRun, opacity, replayKey, translateY]);

  useAnimatedReaction(
    () => entranceSignal?.value ?? null,
    (current, previous) => {
      if (entranceSignal && previous !== null && current !== previous) {
        latestRun.value += 1;
        runSectionEntrance(index, opacity, translateY);
      }
    },
    [entranceSignal, index, latestRun, opacity, translateY],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[styles.section, style, animatedStyle]}>{children}</Animated.View>;
});

const styles = StyleSheet.create({
  section: {
    maxWidth: '100%',
    width: '100%',
  },
});
