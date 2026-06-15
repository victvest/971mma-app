import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts, palette } from '../../theme';

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

/** Animated ring stat — sessions, streak, points. */
export function StatRing({ value, max = 100, label, sub, size = 108, tone = 'green' }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const pct = Math.min(1, Math.max(0, value / max));
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = TONE_COLOR[tone];

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: pct,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
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
        <Text style={styles.value}>{value}</Text>
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
