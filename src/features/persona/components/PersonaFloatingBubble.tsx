import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { FLOATING_CHROME_ELEVATION } from '@/features/home/components/navigation/floatingChromeElevation';
import { triggerLightImpact, triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { PERSONA_ASSISTANT_NAME } from '../constants';
import type { PersonaBubblePosition } from '../types';
import { PersonaAvatar } from './PersonaAvatar';

export const PERSONA_BUBBLE_SIZE = 64;

const DRAG_ACTIVATION = 6;
const PORTRAIT_INSET = 3;

type Props = {
  position: PersonaBubblePosition;
  visible: boolean;
  onOpenChat: () => void;
  onPositionChange: (position: PersonaBubblePosition) => void;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
};

/**
 * Draggable persona bubble. Uses BlurView ring (not native GlassView) to avoid
 * layout glitches when layered over scrollable content.
 */
export const PersonaFloatingBubble = memo(function PersonaFloatingBubble({
  position,
  visible,
  onOpenChat,
  onPositionChange,
  bounds,
}: Props) {
  const { mode, animations } = useTheme();
  const translateX = useSharedValue(position.x);
  const translateY = useSharedValue(position.y);
  const dragOriginX = useSharedValue(position.x);
  const dragOriginY = useSharedValue(position.y);
  const scale = useSharedValue(visible ? 1 : 0.82);
  const opacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    translateX.value = position.x;
    translateY.value = position.y;
    dragOriginX.value = position.x;
    dragOriginY.value = position.y;
  }, [dragOriginX, dragOriginY, position.x, position.y, translateX, translateY]);

  useEffect(() => {
    scale.value = withSpring(visible ? 1 : 0.82, animations.motion.tabBar.iconFocus);
    opacity.value = withSpring(visible ? 1 : 0, animations.motion.tabBar.iconFocus);
  }, [animations.motion.tabBar.iconFocus, opacity, scale, visible]);

  const commitPosition = useCallback(
    (next: PersonaBubblePosition) => {
      onPositionChange(next);
    },
    [onPositionChange],
  );

  const handleOpenChat = useCallback(() => {
    triggerSelectionHaptic();
    onOpenChat();
  }, [onOpenChat]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(DRAG_ACTIVATION)
        .onStart(() => {
          dragOriginX.value = translateX.value;
          dragOriginY.value = translateY.value;
          scale.value = withSpring(1.08, animations.motion.tabBar.iconFocus);
          runOnJS(triggerLightImpact)();
        })
        .onUpdate((event) => {
          translateX.value = Math.min(
            Math.max(dragOriginX.value + event.translationX, bounds.minX),
            bounds.maxX,
          );
          translateY.value = Math.min(
            Math.max(dragOriginY.value + event.translationY, bounds.minY),
            bounds.maxY,
          );
        })
        .onEnd(() => {
          const midpoint = (bounds.minX + bounds.maxX) / 2;
          const snappedX = translateX.value <= midpoint ? bounds.minX : bounds.maxX;
          const snappedY = Math.min(
            Math.max(translateY.value, bounds.minY),
            bounds.maxY,
          );

          scale.value = withSpring(1, animations.motion.tabBar.iconFocus);
          translateX.value = withSpring(snappedX, animations.motion.tabBar.capsule);
          translateY.value = withSpring(
            snappedY,
            animations.motion.tabBar.capsule,
            (finished) => {
              if (finished) {
                runOnJS(commitPosition)({ x: snappedX, y: snappedY });
              }
            },
          );
        }),
    [
      animations.motion.tabBar.capsule,
      animations.motion.tabBar.iconFocus,
      bounds.maxX,
      bounds.maxY,
      bounds.minX,
      bounds.minY,
      commitPosition,
      dragOriginX,
      dragOriginY,
      scale,
      translateX,
      translateY,
    ],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        runOnJS(handleOpenChat)();
      }),
    [handleOpenChat],
  );

  const gesture = useMemo(
    () => Gesture.Exclusive(panGesture, tapGesture),
    [panGesture, tapGesture],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const portraitSize = PERSONA_BUBBLE_SIZE - PORTRAIT_INSET * 2;
  const ringBackground = mode === 'dark' ? 'rgba(25, 25, 22, 0.55)' : 'rgba(255, 255, 255, 0.65)';
  const ringBorder = mode === 'dark' ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.08)';

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        accessibilityRole="button"
        accessibilityLabel={`Open ${PERSONA_ASSISTANT_NAME}`}
        accessibilityHint="Drag to reposition. Tap to open chat."
        style={[
          styles.shell,
          FLOATING_CHROME_ELEVATION,
          {
            width: PERSONA_BUBBLE_SIZE,
            height: PERSONA_BUBBLE_SIZE,
            borderRadius: PERSONA_BUBBLE_SIZE / 2,
          },
          animatedStyle,
        ]}
      >
        <View
          style={[
            styles.ring,
            {
              borderRadius: PERSONA_BUBBLE_SIZE / 2,
              borderColor: ringBorder,
              backgroundColor: ringBackground,
            },
          ]}
        >
          <BlurView
            intensity={mode === 'dark' ? 50 : 62}
            tint={mode === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
            style={[StyleSheet.absoluteFill, { borderRadius: PERSONA_BUBBLE_SIZE / 2 }]}
          />
          <View style={styles.portraitWrap}>
            <PersonaAvatar size={portraitSize} />
          </View>
          <View style={styles.onlineDot} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  shell: {
    left: 0,
    position: 'absolute',
    top: 0,
    zIndex: 120,
  },
  ring: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    overflow: 'hidden',
    padding: PORTRAIT_INSET,
  },
  portraitWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    zIndex: 1,
  },
  onlineDot: {
    backgroundColor: '#00843D',
    borderColor: '#FFFFFF',
    borderRadius: 5,
    borderWidth: 1.5,
    bottom: 4,
    height: 10,
    position: 'absolute',
    right: 4,
    width: 10,
    zIndex: 2,
  },
});
