import React, { memo, useLayoutEffect, type ReactNode } from 'react';
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
  /** UI-thread tab refocus replay — preferred on Home (no React re-render). */
  entranceSignal?: SharedValue<number>;
  /** React-state replay for other tabs / pull-to-refresh. */
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

  useLayoutEffect(() => {
    if (!entranceSignal) {
      return;
    }

    runSectionEntrance(index, opacity, translateY);
  }, [entranceSignal, index, opacity, translateY]);

  useLayoutEffect(() => {
    if (entranceSignal) {
      return;
    }

    runSectionEntrance(index, opacity, translateY);
  }, [entranceSignal, index, opacity, replayKey, translateY]);

  useAnimatedReaction(
    () => entranceSignal?.value ?? null,
    (current, previous) => {
      if (entranceSignal && previous !== null && current !== previous) {
        runSectionEntrance(index, opacity, translateY);
      }
    },
    [entranceSignal, index, opacity, translateY],
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
