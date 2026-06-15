import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { colors, fonts, motion, palette } from '../../theme';
import { AnimatedNumber } from '../AnimatedNumber';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  value: number;
  max?: number;
  label: string;
  sub?: string;
  size?: number;
  tone?: 'green' | 'red' | 'gold';
};

const TONE_COLOR = {
  green: palette.green,
  red: palette.red,
  gold: palette.gold,
};

/** Animated ring stat with count-up center value and completion haptic. */
export function StatRing({ value, max = 100, label, sub, size = 108, tone = 'green' }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const pct = Math.min(1, Math.max(0, value / max));
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = TONE_COLOR[tone];
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
    anim.setValue(0);
    const listener = anim.addListener(({ value: v }) => {
      if (!fired.current && v >= pct * 0.98 && pct > 0) {
        fired.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    });

    Animated.timing(anim, {
      toValue: pct,
      duration: motion.duration.slow + 200,
      easing: motion.easing.expoOut,
      useNativeDriver: false,
    }).start();

    return () => anim.removeListener(listener);
  }, [anim, pct]);

  const dashOffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circ, circ * (1 - pct)],
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={palette.insetStrong}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={dashOffset}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        <AnimatedNumber
          value={value}
          duration={motion.duration.slow + 200}
          style={[styles.value, tone === 'red' && { color: palette.red }]}
        />
        <Text style={styles.label}>{label}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: fonts.displayBlack, fontSize: 26, color: colors.text },
  label: { fontFamily: fonts.semi, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  sub: { fontFamily: fonts.medium, fontSize: 10, color: colors.textFaint, marginTop: 1 },
});
