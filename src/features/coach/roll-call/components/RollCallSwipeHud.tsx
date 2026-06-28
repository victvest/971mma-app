import React, { memo, useMemo } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import {
  HUD_SCREEN_HEIGHT_RATIO,
  HUD_WING_WIDTH_RATIO,
  rollCallHudBadgeScale,
  rollCallHudGlowRadius,
  rollCallHudIconScale,
  rollCallHudLabelEmphasis,
  rollCallHudWingFillOpacity,
  rollCallHudWingOpacity,
} from '@/features/coach/roll-call/utils/rollCallGestures';
import { useTheme } from '@/shared/theme';

function wingCurveStyle(side: 'left' | 'right', wingWidth: number, hudHeight: number): ViewStyle {
  const outerRadius = Math.min(wingWidth * 0.52, hudHeight * 0.5);
  const innerRadius = Math.max(18, wingWidth * 0.22);

  if (side === 'left') {
    return {
      borderTopLeftRadius: outerRadius,
      borderBottomLeftRadius: outerRadius,
      borderTopRightRadius: innerRadius,
      borderBottomRightRadius: innerRadius,
      ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : null),
    };
  }

  return {
    borderTopRightRadius: outerRadius,
    borderBottomRightRadius: outerRadius,
    borderTopLeftRadius: innerRadius,
    borderBottomLeftRadius: innerRadius,
    ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' as const } : null),
  };
}

type FloatingHudWingProps = {
  side: 'left' | 'right';
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  accentBorder: string;
  wingWidth: number;
  hudHeight: number;
  curveStyle: ViewStyle;
  translateX: SharedValue<number>;
  hudReveal: SharedValue<number>;
  screenWidth: number;
};

const FloatingHudWing = memo(function FloatingHudWing({
  side,
  label,
  iconName,
  accentColor,
  accentBorder,
  wingWidth,
  hudHeight,
  curveStyle,
  translateX,
  hudReveal,
  screenWidth,
}: FloatingHudWingProps) {
  const { colors, gap, typography } = useTheme();

  const wingStyle = useAnimatedStyle(() => {
    const opacity = rollCallHudWingOpacity(
      side,
      translateX.value,
      screenWidth,
      hudReveal.value,
    );
    const scale = rollCallHudBadgeScale(side, translateX.value, screenWidth, hudReveal.value);
    const glow = rollCallHudGlowRadius(side, translateX.value, screenWidth, hudReveal.value);

    return {
      opacity,
      transform: [{ scale }],
      shadowRadius: glow,
      shadowOpacity: 0.16 + opacity * 0.2,
    };
  });

  const fillStyle = useAnimatedStyle(() => ({
    opacity: rollCallHudWingFillOpacity(side, translateX.value, screenWidth, hudReveal.value),
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: rollCallHudIconScale(side, translateX.value, screenWidth, hudReveal.value),
      },
    ],
  }));

  const labelStrongStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + rollCallHudLabelEmphasis(side, translateX.value, screenWidth) * 0.65,
  }));

  const labelSoftStyle = useAnimatedStyle(() => ({
    opacity: 0.55 - rollCallHudLabelEmphasis(side, translateX.value, screenWidth) * 0.35,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wing,
        side === 'left' ? styles.wingLeft : styles.wingRight,
        curveStyle,
        {
          width: wingWidth,
          height: hudHeight,
          marginTop: -hudHeight / 2,
          shadowColor: accentColor,
        },
        wingStyle,
      ]}
    >
      <Animated.View
        style={[
          styles.colorSpread,
          curveStyle,
          fillStyle,
          {
            backgroundColor: accentColor,
            borderColor: accentBorder,
          },
        ]}
      />

      <View style={[styles.content, { gap: gap.sm }]}>
        <Animated.View style={[styles.badgeOrb, badgeStyle, { backgroundColor: accentColor }]}>
          <Ionicons name={iconName} size={34} color={colors.text.inverse} />
        </Animated.View>

        <View style={styles.labelStack}>
          <Animated.Text
            style={[
              typography.textPresets.captionMedium,
              styles.label,
              labelSoftStyle,
              { color: colors.text.inverse },
            ]}
          >
            {label}
          </Animated.Text>
          <Animated.Text
            style={[
              typography.textPresets.label,
              styles.label,
              styles.labelStrong,
              labelStrongStyle,
              { color: colors.text.inverse },
            ]}
          >
            {label}
          </Animated.Text>
        </View>
      </View>
    </Animated.View>
  );
});

type Props = {
  translateX: SharedValue<number>;
  hudReveal: SharedValue<number>;
  screenWidth: number;
  screenHeight: number;
};

export const RollCallSwipeHud = memo(function RollCallSwipeHud({
  translateX,
  hudReveal,
  screenWidth,
  screenHeight,
}: Props) {
  const { colors } = useTheme();
  const wingWidth = useMemo(
    () => Math.max(screenWidth * HUD_WING_WIDTH_RATIO, screenWidth * 0.15),
    [screenWidth],
  );
  const hudHeight = useMemo(
    () => screenHeight * HUD_SCREEN_HEIGHT_RATIO,
    [screenHeight],
  );
  const leftCurve = useMemo(
    () => wingCurveStyle('left', wingWidth, hudHeight),
    [hudHeight, wingWidth],
  );
  const rightCurve = useMemo(
    () => wingCurveStyle('right', wingWidth, hudHeight),
    [hudHeight, wingWidth],
  );

  return (
    <View pointerEvents="none" style={styles.frame}>
      <FloatingHudWing
        side="left"
        label="ABSENT"
        iconName="close"
        accentColor={colors.status.error}
        accentBorder={colors.status.errorBorder}
        wingWidth={wingWidth}
        hudHeight={hudHeight}
        curveStyle={leftCurve}
        translateX={translateX}
        hudReveal={hudReveal}
        screenWidth={screenWidth}
      />
      <FloatingHudWing
        side="right"
        label="PRESENT"
        iconName="checkmark"
        accentColor={colors.status.success}
        accentBorder={colors.status.successBorder}
        wingWidth={wingWidth}
        hudHeight={hudHeight}
        curveStyle={rightCurve}
        translateX={translateX}
        hudReveal={hudReveal}
        screenWidth={screenWidth}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    ...Platform.select({
      android: { elevation: 20 },
      default: {},
    }),
  },
  wing: {
    justifyContent: 'center',
    position: 'absolute',
    top: '50%',
    ...Platform.select({
      android: { elevation: 16 },
      default: {
        shadowOffset: { width: 0, height: 12 },
      },
    }),
  },
  wingLeft: {
    left: 0,
  },
  wingRight: {
    right: 0,
  },
  colorSpread: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1.5,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    zIndex: 1,
  },
  badgeOrb: {
    alignItems: 'center',
    borderRadius: 9999,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  labelStack: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 18,
    width: '100%',
  },
  label: {
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  labelStrong: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    textAlign: 'center',
  },
});
