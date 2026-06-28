import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { animations } from '@/shared/theme/animations';

type Props = {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  delay?: number;
  duration?: number;
  style?: StyleProp<TextStyle>;
};

function quantize(value: number, decimals: number): number {
  'worklet';
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Count-up number driven by a UI-thread timing animation.
 * Display updates via runOnJS only when the quantized value changes (not every frame),
 * so the final value persists across parent re-renders — unlike TextInput + defaultValue.
 */
export function AnimatedCount({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  delay = 0,
  duration = 1000,
  style,
}: Props) {
  const progress = useSharedValue<number>(0);
  const lastTargetRef = useRef<number | null>(null);

  const format = useCallback(
    (n: number) => `${prefix}${n.toFixed(decimals)}${suffix}`,
    [decimals, prefix, suffix],
  );

  const [display, setDisplay] = useState(() => format(0));

  const syncDisplay = useCallback((n: number) => setDisplay(format(n)), [format]);

  useEffect(() => {
    if (lastTargetRef.current === value) return;
    lastTargetRef.current = value;

    progress.value = 0;
    setDisplay(format(0));
    progress.value = withDelay(
      delay,
      withTiming(value, { duration, easing: animations.easingCurves.decelerate }),
    );
  }, [delay, duration, format, progress, value]);

  useAnimatedReaction(
    () => quantize(progress.value, decimals),
    (current, previous) => {
      if (current === previous) return;
      runOnJS(syncDisplay)(current);
    },
    [decimals],
  );

  return <Text style={[styles.text, style]}>{display}</Text>;
}

const styles = StyleSheet.create({
  text: {
    margin: 0,
    padding: 0,
  },
});
