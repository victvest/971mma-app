import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { QrCode, ArrowLeft, Calendar } from 'lucide-react-native';
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

type Tone = 'primary' | 'secondary';

type Props = {
  icon: 'qr-code' | 'arrow-back' | 'calendar';
  label: string;
  onPress: () => void;
  tone?: Tone;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Sticky bottom CTA with liquid-glass chrome, shared by detail screens. */
export function DetailActionBar({ icon, label, onPress, tone = 'primary' }: Props) {
  const { colors, typography, inset, radius, gap, layout } = useTheme();
  const safeInsets = useSafeAreaInsets();

  const entrance = useSharedValue<number>(0);
  const scale = useSharedValue<number>(1);

  useEffect(() => {
    entrance.value = withTiming(1, { duration: 380, easing: animations.easingCurves.decelerate });
  }, [entrance]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * 52 }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = useCallback(() => {
    triggerMediumImpact();
    scale.value = withSpring(0.97, animations.spring.snappy);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animations.spring.snappy);
  }, [scale]);

  const isPrimary = tone === 'primary';
  const fg = isPrimary ? colors.accent.onAccent : colors.text.primary;
  const Icon = icon === 'qr-code' ? QrCode : icon === 'calendar' ? Calendar : ArrowLeft;

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
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={[
            styles.button,
            {
              backgroundColor: isPrimary ? colors.accent.default : colors.surface.secondary,
              borderColor: isPrimary ? colors.accent.default : colors.border.subtle,
              borderWidth: layout.borderWidth,
              borderRadius: radius.button,
              minHeight: layout.coachActionHeight,
              gap: gap.sm,
            },
            buttonStyle,
          ]}
        >
          <Icon size={20} color={fg} strokeWidth={2.25} />
          <Text style={[typography.textPresets.button, { color: fg }]}>{label}</Text>
        </AnimatedPressable>
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
