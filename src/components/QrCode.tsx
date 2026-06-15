import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, palette } from '../theme';

/**
 * Deterministic QR-style visual with a live scan-line and soft pulse —
 * reads like an active member pass, not a static placeholder.
 */
function seededMatrix(seed: string, size: number) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
  const grid: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) row.push(rand() > 0.52);
    grid.push(row);
  }
  return grid;
}

function inFinder(r: number, c: number, size: number) {
  const f = 7;
  const tl = r < f && c < f;
  const tr = r < f && c >= size - f;
  const bl = r >= size - f && c < f;
  return tl || tr || bl;
}

type Props = {
  seed: string;
  size?: number;
  animated?: boolean;
};

export function QrCode({ seed, size = 200, animated = true }: Props) {
  const dims = 21;
  const grid = useMemo(() => seededMatrix(seed, dims), [seed]);
  const cell = size / dims;

  const reveal = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;

    Animated.timing(reveal, {
      toValue: 1,
      duration: 680,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(320),
        Animated.timing(scan, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    scanLoop.start();
    pulseLoop.start();
    return () => {
      scanLoop.stop();
      pulseLoop.stop();
    };
  }, [animated, pulse, reveal, scan]);

  const scanY = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [4, size - 8],
  });
  const frameOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.85],
  });
  const gridOpacity = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 1],
  });

  return (
    <View style={[styles.outer, { width: size + 16, height: size + 16 }]}>
      {animated ? (
        <Animated.View style={[styles.frameGlow, { opacity: frameOpacity }]} pointerEvents="none" />
      ) : null}

      <Animated.View style={[styles.wrap, { width: size, height: size, opacity: gridOpacity }]}>
        {grid.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {row.map((on, c) => {
              const finder = inFinder(r, c, dims);
              return (
                <View
                  key={c}
                  style={{
                    width: cell,
                    height: cell,
                    backgroundColor: finder ? 'transparent' : on ? palette.black : 'transparent',
                    borderRadius: on && cell > 3 ? 1 : 0,
                  }}
                />
              );
            })}
          </View>
        ))}
        <Finder style={{ top: 0, left: 0 }} cell={cell} />
        <Finder style={{ top: 0, right: 0 }} cell={cell} />
        <Finder style={{ bottom: 0, left: 0 }} cell={cell} />

        {animated ? (
          <>
            <Animated.View
              style={[styles.scanLine, { transform: [{ translateY: scanY }] }]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={['transparent', 'rgba(21,99,58,0.12)', palette.greenBright, palette.red, 'rgba(139,30,34,0.12)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.scanGrad}
              />
            </Animated.View>
            <CornerBracket style={{ top: 6, left: 6 }} />
            <CornerBracket style={{ top: 6, right: 6 }} flipH />
            <CornerBracket style={{ bottom: 6, left: 6 }} flipV />
            <CornerBracket style={{ bottom: 6, right: 6 }} flipH flipV />
          </>
        ) : null}
      </Animated.View>
    </View>
  );
}

function Finder({ style, cell }: { style: object; cell: number }) {
  const s = cell * 7;
  return (
    <View style={[styles.finder, { width: s, height: s, borderWidth: cell }, style]}>
      <View style={{ width: cell * 3, height: cell * 3, backgroundColor: colors.text }} />
    </View>
  );
}

function CornerBracket({
  style,
  flipH,
  flipV,
}: {
  style: object;
  flipH?: boolean;
  flipV?: boolean;
}) {
  const transform = [];
  if (flipH) transform.push({ scaleX: -1 });
  if (flipV) transform.push({ scaleY: -1 });

  return (
    <View
      style={[styles.bracket, style, transform.length ? { transform } : null]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  frameGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: palette.greenLine,
    backgroundColor: palette.greenGlass,
  },
  wrap: {
    backgroundColor: '#fff',
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15,23,18,0.06)',
  },
  finder: {
    position: 'absolute',
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    zIndex: 4,
  },
  scanGrad: {
    flex: 1,
    shadowColor: palette.greenBright,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  bracket: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderColor: palette.green,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderRadius: 3,
    zIndex: 3,
  },
});
