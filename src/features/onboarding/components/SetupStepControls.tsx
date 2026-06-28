import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ArrowLeft, Check } from 'lucide-react-native';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SetupStepControlsProps = {
  step: number;
  totalSteps: number;
  loading?: boolean;
  disabled?: boolean;
  onBack: () => void;
  onPrimary: () => void;
  continueLabel?: string;
  finalLabel?: string;
};

export function SetupStepControls({
  step,
  totalSteps,
  loading = false,
  disabled = false,
  onBack,
  onPrimary,
  continueLabel = 'Continue',
  finalLabel = 'Get started',
}: SetupStepControlsProps) {
  const { colors, typography, inset, gap, radius, layout, animations } = useTheme();
  const [rowWidth, setRowWidth] = useState(0);
  const backProgress = useSharedValue(step > 0 ? 1 : 0);
  const finalProgress = useSharedValue(step === totalSteps - 1 ? 1 : 0);
  const primaryScale = useSharedValue<number>(animations.scale.resting);
  const backScale = useSharedValue<number>(animations.scale.resting);
  const isFinalStep = step === totalSteps - 1;
  const inactive = disabled || loading;

  useEffect(() => {
    backProgress.value = withSpring(step > 0 ? 1 : 0, animations.spring.snappy);
    finalProgress.value = withTiming(step === totalSteps - 1 ? 1 : 0, animations.timing.press);
  }, [
    animations.spring.snappy,
    animations.timing.press,
    backProgress,
    finalProgress,
    step,
    totalSteps,
  ]);

  const backButtonWidth = rowWidth > 0
    ? Math.min(layout.authButtonHeight * 1.72, Math.max(layout.authButtonHeight * 1.4, rowWidth * 0.28))
    : layout.authButtonHeight * 1.55;
  const handleControlsLayout = useCallback((event: LayoutChangeEvent) => {
    setRowWidth(event.nativeEvent.layout.width);
  }, []);

  const backStyle = useAnimatedStyle(() => ({
    marginRight: interpolate(backProgress.value, [0, 1], [0, gap.sm], Extrapolation.CLAMP),
    opacity: interpolate(backProgress.value, [0, 0.65, 1], [0, 0.35, 1], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(backProgress.value, [0, 1], [-18, 0], Extrapolation.CLAMP) },
      { scale: backScale.value },
    ],
    width: interpolate(backProgress.value, [0, 1], [0, backButtonWidth], Extrapolation.CLAMP),
  }));

  const primaryStyle = useAnimatedStyle(() => ({
    transform: [{ scale: primaryScale.value }],
  }));

  const continueLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(finalProgress.value, [0, 0.42, 1], [1, 0, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(finalProgress.value, [0, 1], [0, -22], Extrapolation.CLAMP) },
    ],
  }));

  const finalLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(finalProgress.value, [0, 0.58, 1], [0, 0, 1], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(finalProgress.value, [0, 1], [24, 0], Extrapolation.CLAMP) },
    ],
  }));

  const primaryForeground = inactive ? colors.text.tertiary : colors.accent.onAccent;

  return (
    <View onLayout={handleControlsLayout} style={styles.setupControlsRow}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPressIn={() => {
          triggerLightImpact();
          backScale.value = withSpring(animations.scale.pressed, animations.spring.snappy);
        }}
        onPressOut={() => {
          backScale.value = withSpring(animations.scale.resting, animations.spring.snappy);
        }}
        onPress={onBack}
        pointerEvents={step > 0 ? 'auto' : 'none'}
        style={[
          styles.setupBackButton,
          {
            minHeight: layout.authButtonHeight,
            borderRadius: radius.button,
            backgroundColor: colors.background.elevated,
            borderColor: colors.border.subtle,
            borderWidth: layout.borderWidth,
          },
          backStyle,
        ]}
      >
        <ArrowLeft size={17} color={colors.text.primary} strokeWidth={2.5} />
        <Text
          style={[typography.textPresets.button, { color: colors.text.primary }]}
          numberOfLines={1}
        >
          Back
        </Text>
      </AnimatedPressable>

      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={isFinalStep ? finalLabel : continueLabel}
        disabled={inactive}
        onPressIn={() => {
          if (!inactive) {
            triggerLightImpact();
            primaryScale.value = withSpring(animations.scale.pressed, animations.spring.snappy);
          }
        }}
        onPressOut={() => {
          primaryScale.value = withSpring(animations.scale.resting, animations.spring.snappy);
        }}
        onPress={onPrimary}
        style={[
          styles.setupPrimaryButton,
          {
            minHeight: layout.authButtonHeight,
            paddingHorizontal: inset.lg,
            borderRadius: radius.button,
            backgroundColor: inactive ? colors.fill.secondary : colors.accent.default,
          },
          primaryStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={primaryForeground} />
        ) : (
          <View
            style={[
              styles.setupLabelSlot,
              {
                height: typography.fontSize.xl,
                minWidth: layout.authButtonHeight * 2.4,
              },
            ]}
          >
            <Animated.View style={[styles.setupLabelLayer, continueLabelStyle]}>
              <Text style={[typography.textPresets.button, { color: primaryForeground }]}>
                {continueLabel}
              </Text>
            </Animated.View>
            <Animated.View style={[styles.setupLabelLayer, { gap: gap.xs }, finalLabelStyle]}>
              <Check size={18} color={primaryForeground} strokeWidth={2.8} />
              <Text style={[typography.textPresets.button, { color: primaryForeground }]}>
                {finalLabel}
              </Text>
            </Animated.View>
          </View>
        )}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  setupControlsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
    width: '100%',
  },
  setupBackButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  setupPrimaryButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  setupLabelSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupLabelLayer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
  },
});
