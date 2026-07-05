import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LiquidGlassSurface } from '@/shared/components/ui';
import { triggerMediumImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';

type Props = {
  memberName: string;
  beltRank: string;
  targetStripe: number;
  canAward: boolean;
  loading: boolean;
  blockedReason: string | null;
  onAward: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CoachBeltReviewAwardBar({
  memberName,
  beltRank,
  targetStripe,
  canAward,
  loading,
  blockedReason,
  onAward,
}: Props) {
  const { colors, typography, inset, radius, gap, layout } = useTheme();
  const safeInsets = useSafeAreaInsets();

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

  const handlePressIn = useCallback(() => {
    if (!canAward || loading) return;
    triggerMediumImpact();
    scale.value = withSpring(0.97, animations.spring.snappy);
  }, [canAward, loading, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animations.spring.snappy);
  }, [scale]);

  const disabled = !canAward || loading;

  return (
    <Animated.View style={[styles.wrap, wrapStyle]} pointerEvents="box-none">
      <LinearGradient
        pointerEvents="none"
        colors={[`${colors.background.primary}00`, colors.background.primary]}
        locations={[0, 0.7]}
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
            gap: gap.xs,
          },
        ]}
      >
        <AnimatedPressable
          onPress={onAward}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Award stripe"
          accessibilityState={{ disabled }}
          style={[
            styles.button,
            {
              backgroundColor: canAward ? colors.accent.default : colors.fill.secondary,
              borderColor: canAward ? colors.accent.default : colors.border.subtle,
              borderWidth: layout.borderWidth,
              borderRadius: radius.button,
              minHeight: layout.coachActionHeight,
              gap: gap.sm,
              opacity: disabled && !loading ? 0.72 : 1,
            },
            buttonStyle,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.accent.onAccent} />
          ) : (
            <>
              <Ionicons
                name="ribbon"
                size={20}
                color={canAward ? colors.accent.onAccent : colors.text.tertiary}
              />
              <Text
                style={[
                  typography.textPresets.button,
                  { color: canAward ? colors.accent.onAccent : colors.text.tertiary },
                ]}
              >
                Award stripe
              </Text>
            </>
          )}
        </AnimatedPressable>
        <Text
          style={[
            typography.textPresets.caption,
            { color: colors.text.tertiary, textAlign: 'center' },
          ]}
          numberOfLines={2}
        >
          {blockedReason ??
            `Promotes ${memberName.split(' ')[0] ?? memberName} to stripe ${targetStripe} on ${beltRank}.`}
        </Text>
      </LiquidGlassSurface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 30,
  },
  scrim: {
    height: 56,
    left: 0,
    position: 'absolute',
    right: 0,
    top: -56,
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
