import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  AccessibilityActionEvent,
  StyleSheet,
  Text,
  View,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { RollCallCard } from '@/features/coach/roll-call/components/RollCallCard';
import { RollCallSwipeHud } from '@/features/coach/roll-call/components/RollCallSwipeHud';
import type { RollCallDeckMember } from '@/features/coach/roll-call/types';
import {
  HUD_DISMISS_DURATION_MS,
  HUD_REVEAL_DURATION_MS,
  ROLL_CALL_STACK_MAX_VISIBLE,
  ROLL_CALL_STACK_PEEK_Y,
  ROLL_CALL_STACK_ROTATION_MAX_DEG,
  ROLL_CALL_STACK_SCALE_STEP,
  rollCallResolveCommit,
  type RollCallSwipeCommit,
} from '@/features/coach/roll-call/utils/rollCallGestures';
import { MotiPressable } from '@/shared/animations/MotiPressable';
import { triggerLightImpact, triggerSuccessNotification } from '@/shared/haptics';
import { shadows, useTheme } from '@/shared/theme';
import { androidStackingLayer } from '@/shared/theme/surfaceShadow';

export type RollCallSwipeableCardHandle = {
  undo: () => void;
};

type Props = {
  /**
   * Full stable swipe queue (absolute indices). Do NOT pass a sliding window —
   * that was the root cause of the snap (relative stackIndex + progress reset).
   */
  members: RollCallDeckMember[];
  /** Absolute index of the front card in `members` (inspiration `currentIndex`). */
  currentIndex: number;
  screenWidth: number;
  screenHeight: number;
  cardInset?: number;
  enabled?: boolean;
  /** QR recognition pass — swipe advances without Present/Absent HUD. */
  acknowledgeOnly?: boolean;
  undoSignal?: number;
  /** Fired only after the exit timing finishes — parent may then advance `currentIndex`. */
  onCommit: (direction: RollCallSwipeCommit) => void;
  style?: StyleProp<ViewStyle>;
};

type StackCardProps = {
  member: RollCallDeckMember;
  index: number;
  currentIndex: number;
  dataLength: number;
  maxVisibleItems: number;
  cardInset: number;
  screenWidth: number;
  enabled: boolean;
  acknowledgeOnly: boolean;
  animatedValue: SharedValue<number>;
  activeTranslateX: SharedValue<number>;
  hudReveal: SharedValue<number>;
  canCommit: SharedValue<number>;
  onCommit: (direction: RollCallSwipeCommit) => void;
  accessibilityLabel?: string;
  accessibilityActions?: { name: 'increment' | 'decrement'; label: string }[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
};

const EXIT_TIMING = {} as const;
const RESET_TIMING = { duration: 500 } as const;

const RollCallSwipeFallback = memo(function RollCallSwipeFallback({
  onPresent,
  onAbsent,
  acknowledgeOnly,
}: {
  onPresent: () => void;
  onAbsent: () => void;
  acknowledgeOnly?: boolean;
}) {
  const { colors, inset, radius, typography, gap } = useTheme();

  const handlePresent = useCallback(() => {
    triggerLightImpact();
    onPresent();
  }, [onPresent]);

  const handleAbsent = useCallback(() => {
    triggerLightImpact();
    onAbsent();
  }, [onAbsent]);

  if (acknowledgeOnly) {
    return (
      <View style={[styles.fallbackRow, { gap: gap.sm, paddingHorizontal: inset.lg }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue"
          onPress={handlePresent}
          style={[
            styles.fallbackButton,
            {
              backgroundColor: colors.fill.secondary,
              borderColor: colors.border.default,
              borderRadius: radius.button,
              paddingVertical: inset.md,
            },
          ]}
        >
          <Text style={[typography.textPresets.label, { color: colors.text.primary }]}>
            Continue
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.fallbackRow, { gap: gap.sm, paddingTop: inset.md }]}>
      <Pressable
        onPress={handleAbsent}
        accessibilityLabel="Mark absent"
        style={[
          styles.fallbackButton,
          {
            minHeight: 48,
            borderRadius: radius.button,
            backgroundColor: colors.surface.primary,
            borderColor: colors.status.error,
          },
        ]}
      >
        <Text style={[typography.textPresets.button, { color: colors.status.error }]}>Absent</Text>
      </Pressable>
      <MotiPressable
        onPress={handlePresent}
        accessibilityLabel="Mark present"
        style={[
          styles.fallbackButton,
          {
            minHeight: 48,
            borderRadius: radius.button,
            backgroundColor: colors.status.successSubtle,
            borderColor: colors.status.successBorder,
          },
        ]}
      >
        <Text style={[typography.textPresets.button, { color: colors.status.success }]}>
          Present
        </Text>
      </MotiPressable>
    </View>
  );
});

/**
 * One card in the absolute-index stack — mirrors Inspiration `Card.tsx`.
 * Each card owns its translateX so the next front never inherits an off-screen X.
 */
const RollCallStackCard = memo(function RollCallStackCard({
  member,
  index,
  currentIndex,
  dataLength,
  maxVisibleItems,
  cardInset,
  screenWidth,
  enabled,
  acknowledgeOnly,
  animatedValue,
  activeTranslateX,
  hudReveal,
  canCommit,
  onCommit,
  accessibilityLabel,
  accessibilityActions,
  onAccessibilityAction,
}: StackCardProps) {
  const translateX = useSharedValue(0);
  const direction = useSharedValue(0);
  const isFront = index === currentIndex;

  const finishCommit = useCallback(
    (commit: RollCallSwipeCommit) => {
      triggerSuccessNotification();
      onCommit(commit);
    },
    [onCommit],
  );

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(enabled)
      .activeOffsetX([-8, 8])
      .onBegin(() => {
        if (index !== currentIndex) return;
        if (!acknowledgeOnly) {
          hudReveal.value = withTiming(1, { duration: HUD_REVEAL_DURATION_MS });
        }
        runOnJS(triggerLightImpact)();
      })
      .onUpdate((event) => {
        // Inspiration: only the absolute front card drives motion
        if (index !== currentIndex) return;
        const isSwipeRight = event.translationX > 0;
        direction.value = isSwipeRight ? 1 : -1;
        translateX.value = event.translationX;
        activeTranslateX.value = event.translationX;
        animatedValue.value = interpolate(
          Math.abs(event.translationX),
          [0, screenWidth],
          [index, index + 1],
        );
      })
      .onEnd((event) => {
        if (index !== currentIndex) return;
        hudReveal.value = withTiming(0, { duration: HUD_DISMISS_DURATION_MS });

        const commit = rollCallResolveCommit(translateX.value, screenWidth);
        const fling =
          Math.abs(event.translationX) > 150 || Math.abs(event.velocityX) > 1000;

        if ((commit || fling) && canCommit.value === 1) {
          canCommit.value = 0;
          const swipeDirection: RollCallSwipeCommit =
            commit ?? (direction.value >= 0 ? 'attended' : 'absent');
          direction.value = swipeDirection === 'attended' ? 1 : -1;

          translateX.value = withTiming(screenWidth * direction.value, EXIT_TIMING, (finished) => {
            if (!finished) return;
            runOnJS(finishCommit)(swipeDirection);
          });
          animatedValue.value = withTiming(index + 1, EXIT_TIMING);
          activeTranslateX.value = withTiming(screenWidth * direction.value, EXIT_TIMING);
          return;
        }

        translateX.value = withTiming(0, RESET_TIMING);
        activeTranslateX.value = withTiming(0, RESET_TIMING);
        animatedValue.value = withTiming(currentIndex, RESET_TIMING);
      })
      .onFinalize(() => {
        if (index !== currentIndex) return;
        hudReveal.value = withTiming(0, { duration: HUD_DISMISS_DURATION_MS });
      });
  }, [
    acknowledgeOnly,
    activeTranslateX,
    animatedValue,
    canCommit,
    currentIndex,
    direction,
    enabled,
    finishCommit,
    hudReveal,
    index,
    screenWidth,
    translateX,
  ]);

  const animatedStyle = useAnimatedStyle(() => {
    const currentItem = index === currentIndex;

    // Inspiration stack rise — absolute index against monotonic animatedValue.
    // No CLAMP: behind cards must extrapolate (2nd peek = -60 / 0.8 at rest).
    const translateY = interpolate(
      animatedValue.value,
      [index - 1, index],
      [-ROLL_CALL_STACK_PEEK_Y, 0],
    );
    const scale = interpolate(
      animatedValue.value,
      [index - 1, index],
      [1 - ROLL_CALL_STACK_SCALE_STEP, 1],
    );
    const rotateZ = interpolate(
      Math.abs(translateX.value),
      [0, screenWidth],
      [0, ROLL_CALL_STACK_ROTATION_MAX_DEG],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      animatedValue.value + maxVisibleItems,
      [index, index + 1],
      [0, 1],
    );

    return {
      opacity: index < currentIndex + maxVisibleItems ? 1 : opacity,
      zIndex: dataLength - index,
      transform: [
        { translateY: currentItem ? 0 : translateY },
        { scale: currentItem ? 1 : scale },
        { translateX: translateX.value },
        { rotateZ: currentItem ? `${direction.value * rotateZ}deg` : '0deg' },
      ],
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        pointerEvents={isFront ? 'auto' : 'none'}
        style={[
          StyleSheet.absoluteFill,
          styles.stackCard,
          shadows.mediaHero,
          androidStackingLayer(dataLength - index),
          { marginHorizontal: cardInset },
          animatedStyle,
        ]}
        accessible={isFront}
        accessibilityRole={isFront ? 'adjustable' : undefined}
        accessibilityLabel={isFront ? accessibilityLabel : undefined}
        accessibilityHint={
          isFront
            ? acknowledgeOnly
              ? 'Swipe either direction to continue. This member is already present via QR.'
              : 'Use swipe gestures, or the increment and decrement accessibility actions, to mark attendance.'
            : undefined
        }
        accessibilityActions={isFront ? accessibilityActions : undefined}
        onAccessibilityAction={isFront ? onAccessibilityAction : undefined}
      >
        <RollCallCard member={member} style={styles.cardFill} />
      </Animated.View>
    </GestureDetector>
  );
});

export const RollCallSwipeableCard = memo(
  forwardRef<RollCallSwipeableCardHandle, Props>(function RollCallSwipeableCard(
    {
      members,
      currentIndex,
      screenWidth,
      screenHeight,
      cardInset = 0,
      enabled = true,
      acknowledgeOnly = false,
      undoSignal = 0,
      onCommit,
      style,
    },
    ref,
  ) {
    const reducedMotion = useReducedMotion();
    const frontMember = members[currentIndex] ?? null;

    const animatedValue = useSharedValue(currentIndex);
    const activeTranslateX = useSharedValue(0);
    const hudReveal = useSharedValue(0);
    const canCommit = useSharedValue(1);
    const prevIndexRef = useRef<number | null>(null);
    const onCommitRef = useRef(onCommit);
    onCommitRef.current = onCommit;

    const stableOnCommit = useCallback((direction: RollCallSwipeCommit) => {
      onCommitRef.current(direction);
    }, []);

    // Sync only when the absolute cursor jumps (advance / undo / roster reset).
    // Do NOT rewrite animatedValue on unrelated parent re-renders — that caused snaps.
    useLayoutEffect(() => {
      if (prevIndexRef.current === currentIndex) return;
      prevIndexRef.current = currentIndex;
      animatedValue.value = currentIndex;
      activeTranslateX.value = 0;
      hudReveal.value = 0;
      canCommit.value = 1;
    }, [activeTranslateX, animatedValue, canCommit, currentIndex, hudReveal]);

    const finishCommitFallback = useCallback(
      (direction: RollCallSwipeCommit) => {
        triggerSuccessNotification();
        onCommitRef.current(direction);
      },
      [],
    );

    const handleAccessibilityAction = useCallback(
      (event: AccessibilityActionEvent) => {
        if (event.nativeEvent.actionName === 'increment') {
          finishCommitFallback('attended');
        } else if (event.nativeEvent.actionName === 'decrement') {
          finishCommitFallback('absent');
        }
      },
      [finishCommitFallback],
    );

    const accessibilityLabel = useMemo(
      () =>
        frontMember
          ? acknowledgeOnly
            ? `${frontMember.displayName}. Already present via QR. Swipe to continue.`
            : `${frontMember.displayName}. Swipe right to mark present, swipe left to mark absent.`
          : 'Roll call card',
      [acknowledgeOnly, frontMember],
    );

    const accessibilityActions = useMemo(
      () =>
        acknowledgeOnly
          ? [{ name: 'increment' as const, label: 'Continue' }]
          : [
              { name: 'increment' as const, label: 'Mark present' },
              { name: 'decrement' as const, label: 'Mark absent' },
            ],
      [acknowledgeOnly],
    );

    const undo = useCallback(() => {
      canCommit.value = 1;
      hudReveal.value = withTiming(0, { duration: HUD_DISMISS_DURATION_MS });
      activeTranslateX.value = withTiming(0, RESET_TIMING);
      animatedValue.value = withTiming(currentIndex, RESET_TIMING);
    }, [activeTranslateX, animatedValue, canCommit, currentIndex, hudReveal]);

    useImperativeHandle(ref, () => ({ undo }), [undo]);

    useEffect(() => {
      if (undoSignal > 0) undo();
    }, [undo, undoSignal]);

    const cardFrameStyle = useMemo(() => [styles.cardFrame, style], [style]);

    const visibleCards = useMemo(() => {
      const out: { member: RollCallDeckMember; index: number }[] = [];
      for (let index = currentIndex; index < members.length; index += 1) {
        if (index > currentIndex + ROLL_CALL_STACK_MAX_VISIBLE) break;
        const member = members[index];
        if (!member) continue;
        out.push({ member, index });
      }
      return out;
    }, [currentIndex, members]);

    if (!frontMember) {
      return <View style={cardFrameStyle} />;
    }

    if (reducedMotion) {
      return (
        <View style={cardFrameStyle}>
          <View style={[StyleSheet.absoluteFill, { marginHorizontal: cardInset }]}>
            <RollCallCard member={frontMember} style={styles.cardFill} />
          </View>
          <RollCallSwipeFallback
            acknowledgeOnly={acknowledgeOnly}
            onPresent={() => finishCommitFallback('attended')}
            onAbsent={() => finishCommitFallback('absent')}
          />
        </View>
      );
    }

    return (
      <View style={cardFrameStyle}>
        <View style={styles.stackHost}>
          {visibleCards.map(({ member, index }) => (
            <RollCallStackCard
              key={`${member.deckKey}:${index}`}
              member={member}
              index={index}
              currentIndex={currentIndex}
              dataLength={members.length}
              maxVisibleItems={ROLL_CALL_STACK_MAX_VISIBLE}
              cardInset={cardInset}
              screenWidth={screenWidth}
              enabled={enabled}
              acknowledgeOnly={acknowledgeOnly}
              animatedValue={animatedValue}
              activeTranslateX={activeTranslateX}
              hudReveal={hudReveal}
              canCommit={canCommit}
              onCommit={stableOnCommit}
              accessibilityLabel={accessibilityLabel}
              accessibilityActions={accessibilityActions}
              onAccessibilityAction={handleAccessibilityAction}
            />
          ))}
        </View>
        {acknowledgeOnly ? null : (
          <RollCallSwipeHud
            translateX={activeTranslateX}
            hudReveal={hudReveal}
            screenWidth={screenWidth}
            screenHeight={screenHeight}
          />
        )}
      </View>
    );
  }),
);

const styles = StyleSheet.create({
  cardFrame: {
    flex: 1,
    overflow: 'visible',
  },
  stackHost: {
    flex: 1,
    overflow: 'visible',
  },
  stackCard: {
    overflow: 'visible',
  },
  cardFill: {
    flex: 1,
  },
  fallbackRow: {
    flexDirection: 'row',
  },
  fallbackButton: {
    alignItems: 'center',
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
  },
});
