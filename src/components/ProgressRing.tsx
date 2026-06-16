import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { palette } from '../theme/colors';

type Props = {
  size: number;
  stroke?: number;
  value: number;
  max: number;
  color?: string;
  trackColor?: string;
};

/** Web-safe circular progress arc (no rotation/origin props). */
export function ProgressRing({
  size,
  stroke = 7,
  value,
  max,
  color = palette.green,
  trackColor = palette.insetStrong,
}: Props) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const offset = circ * (1 - pct);
  const center = size / 2;

  return (
    <Svg width={size} height={size}>
      <Circle cx={center} cy={center} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
      <Circle
        cx={center}
        cy={center}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circ} ${circ}`}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </Svg>
  );
}

export function ProgressRingCenter({ children, size }: { children: React.ReactNode; size: number }) {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
