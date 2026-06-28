import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
} from 'react';
import {
  AccessibilityActionEvent,
  Platform,
  StyleSheet,
  Text,
  View,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { RollCallCard } from '@/features/coach/roll-call/components/RollCallCard';
import { RollCallSwipeHud } from '@/features/coach/roll-call/components/RollCallSwipeHud';
import type { RollCallDeckMember } from '@/features/coach/roll-call/types';
import {
  HUD_DISMISS_DURATION_MS,
  HUD_REVEAL_DURATION_MS,
  rollCallCardLiftY,
  rollCallCardRotationDeg,
  rollCallOffscreenTranslation,
  rollCallResolveCommit,
  rollCallSwipeSpringOffscreen,
  rollCallSwipeSpringReset,
  type RollCallSwipeCommit,
} from '@/features/coach/roll-call/utils/rollCallGestures';
import { MotiPressable } from '@/shared/animations/MotiPressable';
import { triggerLightImpact, triggerSuccessNotification } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

export type RollCallSwipeableCardHandle = {
  undo: () => void;
};

type Props = {
  member: RollCallDeckMember;
  screenWidth: number;
  screenHeight: number;
  cardInset?: number;
  enabled?: boolean;
  undoSignal?: number;
  onCommit: (direction: RollCallSwipeCommit) => void;
  style?: StyleProp<ViewStyle>;
};

const RollCallSwipeFallback = memo(function RollCallSwipeFallback({
  onPresent,
  onAbsent,
}: {
  onPresent: () => void;
  onAbsent: () => void;
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

export const RollCallSwipeableCard = memo(
  forwardRef<RollCallSwipeableCardHandle, Props>(function RollCallSwipeableCard(
    { member, screenWidth, screenHeight, cardInset = 0, enabled = true, undoSignal = 0, onCommit, style },
    ref,
  ) {
    const { colors } = useTheme();
    const reducedMotion = useReducedMotion();
    const translateX = useSharedValue(0);
    const rotation = useSharedValue(0);
    const dragContextX = useSharedValue(0);
    const hudReveal = useSharedValue(0);

    const finishCommit = useCallback(
      (direction: RollCallSwipeCommit) => {
        triggerSuccessNotification();
        onCommit(direction);
      },
      [onCommit],
    );

    const commitFromFallback = useCallback(
      (direction: RollCallSwipeCommit) => {
        triggerSuccessNotification();
        onCommit(direction);
      },
      [onCommit],
    );

    const handleAccessibilityAction = useCallback(
      (event: AccessibilityActionEvent) => {
        if (event.nativeEvent.actionName === 'increment') {
          finishCommit('attended');
        } else if (event.nativeEvent.actionName === 'decrement') {
          finishCommit('absent');
        }
      },
      [finishCommit],
    );

    const accessibilityLabel = useMemo(
      () =>
        `${member.displayName}. Swipe right to mark present, swipe left to mark absent.`,
      [member.displayName],
    );

    const accessibilityActions = useMemo(
      () => [
        { name: 'increment' as const, label: 'Mark present' },
        { name: 'decrement' as const, label: 'Mark absent' },
      ],
      [],
    );

    const dismissHud = useCallback(() => {
      hudReveal.value = withTiming(0, { duration: HUD_DISMISS_DURATION_MS });
    }, [hudReveal]);

    const undo = useCallback(() => {
      dismissHud();
      translateX.value = withSpring(0, rollCallSwipeSpringReset);
      rotation.value = withSpring(0, rollCallSwipeSpringReset);
    }, [dismissHud, rotation, translateX]);

    useImperativeHandle(ref, () => ({ undo }), [undo]);

    useEffect(() => {
      hudReveal.value = 0;
      translateX.value = 0;
      rotation.value = 0;
    }, [hudReveal, member.deckKey, rotation, translateX]);

    useEffect(() => {
      if (undoSignal > 0) {
        undo();
      }
    }, [undo, undoSignal]);

    const panGesture = useMemo(() => {
      return Gesture.Pan()
        .enabled(enabled && !reducedMotion)
        .activeOffsetX([-8, 8])
        .onBegin(() => {
          hudReveal.value = withTiming(1, { duration: HUD_REVEAL_DURATION_MS });
          runOnJS(triggerLightImpact)();
        })
        .onStart(() => {
          dragContextX.value = translateX.value;
        })
        .onUpdate((event) => {
          translateX.value = dragContextX.value + event.translationX;
          rotation.value = rollCallCardRotationDeg(translateX.value, screenWidth);
        })
        .onEnd((event) => {
          hudReveal.value = withTiming(0, { duration: HUD_DISMISS_DURATION_MS });
          const commit = rollCallResolveCommit(translateX.value, screenWidth);
          if (commit) {
            const velocityBoost = event.velocityX * 0.15;
            const destination =
              rollCallOffscreenTranslation(screenWidth, commit) + velocityBoost;
            translateX.value = withSpring(destination, rollCallSwipeSpringOffscreen, (finished) => {
              if (finished) {
                runOnJS(finishCommit)(commit);
              }
            });
            rotation.value = withSpring(
              commit === 'attended' ? 12 : -12,
              rollCallSwipeSpringOffscreen,
            );
            return;
          }

          translateX.value = withSpring(0, rollCallSwipeSpringReset);
          rotation.value = withSpring(0, rollCallSwipeSpringReset);
        })
        .onFinalize(() => {
          hudReveal.value = withTiming(0, { duration: HUD_DISMISS_DURATION_MS });
        });
    }, [
      dragContextX,
      enabled,
      finishCommit,
      hudReveal,
      reducedMotion,
      rotation,
      cardInset,
      screenWidth,
      translateX,
    ]);

    const animatedCardStyle = useAnimatedStyle(() => {
      const dragAmount = Math.abs(translateX.value);
      const isDraggingCard = hudReveal.value > 0 && dragAmount > 6;
      const lift = isDraggingCard
        ? rollCallCardLiftY(translateX.value, screenWidth, hudReveal.value)
        : 0;
      const dragShadow = isDraggingCard ? 0.12 : 0;

      return {
        shadowColor: colors.text.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: dragShadow,
        shadowRadius: 18,
        transform: [
          { translateY: lift },
          { translateX: translateX.value },
          { rotate: `${rotation.value}deg` },
        ],
        ...(Platform.OS === 'android' ? { elevation: dragShadow * 20 } : null),
      };
    });

    const cardShellStyle = useMemo(
      () => [styles.cardInner, { marginHorizontal: cardInset }],
      [cardInset],
    );

    const cardFrameStyle = useMemo(
      () => [styles.cardFrame, style],
      [style],
    );

    if (reducedMotion) {
      return (
        <View style={cardFrameStyle}>
          <RollCallCard member={member} style={[styles.cardInner, { marginHorizontal: cardInset }]} />
          <RollCallSwipeFallback
            onPresent={() => commitFromFallback('attended')}
            onAbsent={() => commitFromFallback('absent')}
          />
        </View>
      );
    }

    return (
      <View style={cardFrameStyle}>
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[cardShellStyle, animatedCardStyle]}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint="Use swipe gestures, or the increment and decrement accessibility actions, to mark attendance."
            accessibilityActions={accessibilityActions}
            onAccessibilityAction={handleAccessibilityAction}
          >
            <RollCallCard member={member} style={styles.cardFill} />
          </Animated.View>
        </GestureDetector>
        <RollCallSwipeHud
          translateX={translateX}
          hudReveal={hudReveal}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      </View>
    );
  }),
);

const styles = StyleSheet.create({
  cardFrame: {
    flex: 1,
    overflow: 'visible',
  },
  cardInner: {
    flex: 1,
    zIndex: 1,
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
