import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Bell, BellOff } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { registerForPushNotifications } from '@/features/notifications/services/pushRegistration';
import {
  useClassSubscription,
  useToggleClassSubscription,
} from '@/features/schedule/hooks/useClassSubscription';
import { LiquidGlassSurface } from '@/shared/components/ui';
import { authToast } from '@/shared/components/Toast';
import { triggerMediumImpact, triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';
import { useAuthStore } from '@/stores/useAuthStore';
import type { ClassItem } from '@/types/domain';

type Props = {
  item: ClassItem;
  canSubscribe: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Could not update class notifications.';
}

function isPushTokenRequired(error: unknown): boolean {
  return readErrorMessage(error).includes('PUSH_TOKEN_REQUIRED');
}

export function ClassReminderSubscribeBar({ item, canSubscribe }: Props) {
  const { colors, typography, inset, radius, gap, layout } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const userId = useAuthStore((state) => state.user?.id);
  const subscriptionQuery = useClassSubscription(item.id);
  const toggleMutation = useToggleClassSubscription();

  const subscribed = subscriptionQuery.data === true;
  const loading = subscriptionQuery.isLoading || toggleMutation.isPending;

  const entrance = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    entrance.value = withTiming(1, { duration: 380, easing: animations.easingCurves.decelerate });
  }, [entrance]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * 52 }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = useCallback(async () => {
    if (!userId || loading) return;

    triggerSelectionHaptic();
    const nextValue = !subscribed;

    const subscribe = async () => {
      const result = await toggleMutation.mutateAsync(item.id);
      if (result) {
        authToast.success(
          'Class notifications on',
          'You will receive reminders and updates for this class.',
        );
      } else {
        authToast.success('Class notifications off', 'You will no longer receive updates for this class.');
      }
    };

    try {
      if (nextValue) {
        const push = await registerForPushNotifications({ requestPermission: true });
        if (push.status === 'denied') {
          authToast.error(
            'Notifications disabled',
            'Enable notifications in Settings to subscribe to class updates.',
          );
          return;
        }
        if (push.status !== 'registered') {
          authToast.error(
            'Push unavailable',
            push.message ?? 'Could not register for push notifications on this device.',
          );
          return;
        }
      }

      await subscribe();
    } catch (error) {
      if (nextValue && isPushTokenRequired(error)) {
        const push = await registerForPushNotifications({ requestPermission: true });
        if (push.status === 'registered') {
          try {
            await subscribe();
            return;
          } catch (retryError) {
            authToast.error('Subscription failed', readErrorMessage(retryError));
            return;
          }
        }
        authToast.error(
          'Notifications required',
          push.message ?? 'Enable notifications to subscribe to this class.',
        );
        return;
      }

      const message = readErrorMessage(error);
      if (message.includes('CLASS_STARTED')) {
        authToast.error('Class started', 'You can only subscribe to upcoming classes.');
        return;
      }
      if (message.includes('CLASS_CANCELLED')) {
        authToast.error('Class cancelled', 'This class is no longer on the schedule.');
        return;
      }

      authToast.error('Subscription failed', message);
    }
  }, [item.id, loading, subscribed, toggleMutation, userId]);

  const handlePressIn = useCallback(() => {
    triggerMediumImpact();
    scale.value = withSpring(0.97, animations.spring.snappy);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animations.spring.snappy);
  }, [scale]);

  if (!userId || !canSubscribe) return null;

  const isPrimary = !subscribed;
  const label = subscribed ? 'Unsubscribe' : 'Subscribe to notifications';
  const Icon = subscribed ? BellOff : Bell;
  const fg = isPrimary ? colors.accent.onAccent : colors.text.primary;
  const bg = isPrimary ? colors.accent.default : colors.surface.secondary;
  const borderColor = isPrimary ? colors.accent.default : colors.border.subtle;

  return (
    <Animated.View style={[styles.wrap, wrapStyle]} pointerEvents="box-none">
      <LinearGradient
        pointerEvents="none"
        colors={[`${colors.background.primary}00`, colors.background.primary]}
        locations={[0, 0.65]}
        style={styles.scrim}
      />
      <LiquidGlassSurface
        variant="chrome"
        borderRadius={0}
        showBorder={false}
        style={styles.glassBar}
        contentStyle={[
          styles.bar,
          {
            paddingHorizontal: inset.lg,
            paddingTop: inset.sm,
            paddingBottom: safeInsets.bottom + inset.sm,
          },
        ]}
      >
        <AnimatedPressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={[
            styles.button,
            {
              backgroundColor: bg,
              borderColor,
              borderWidth: layout.borderWidth,
              borderRadius: radius.button,
              minHeight: layout.coachActionHeight,
              gap: gap.sm,
              opacity: loading ? 0.72 : 1,
            },
            buttonStyle,
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={fg} />
          ) : (
            <Icon size={20} color={fg} strokeWidth={2.25} />
          )}
          <Text style={[typography.textPresets.button, { color: fg }]}>{label}</Text>
        </AnimatedPressable>
      </LiquidGlassSurface>
    </Animated.View>
  );
}

export const CLASS_REMINDER_BAR_HEIGHT = 88;

const styles = StyleSheet.create({
  wrap: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 30,
  },
  scrim: {
    height: 48,
    left: 0,
    position: 'absolute',
    right: 0,
    top: -48,
  },
  glassBar: {
    width: '100%',
  },
  bar: {
    width: '100%',
  },
  button: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
