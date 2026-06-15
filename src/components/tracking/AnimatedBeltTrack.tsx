import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, palette, radii, spacing } from '../../theme';

type Props = {
  rank: string;
  stripes: number;
  maxStripes?: number;
  percent: number;
  nextMilestone: string;
  track: string;
};

/** Animated BJJ belt with lighting stripes and progress shimmer. */
export function AnimatedBeltTrack({
  rank,
  stripes,
  maxStripes = 4,
  percent,
  nextMilestone,
  track,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const stripeAnims = useRef(Array.from({ length: maxStripes }, () => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: percent,
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    Animated.stagger(
      120,
      stripeAnims.map((a, i) =>
        Animated.timing(a, {
          toValue: i < stripes ? 1 : 0.25,
          duration: 500,
          delay: 200,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ),
    ).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [percent, progress, pulse, stripeAnims, stripes]);

  const barWidth = progress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] });

  return (
    <View style={styles.wrap}>
      <View style={styles.beltRow}>
        <View style={styles.beltCase}>
          <LinearGradient colors={['#FAFAF7', '#E8E8E2', '#D8D8D0']} style={styles.beltFabric} />
          {stripeAnims.map((a, i) => (
            <Animated.View
              key={i}
              style={[
                styles.stripe,
                { left: 22 + i * 16, opacity: a, transform: [{ scaleY: a }] },
              ]}
            />
          ))}
          <Animated.View style={[styles.beltGlow, { opacity: glowOpacity }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rank}>{rank}</Text>
          <Text style={styles.track}>{track} · {stripes} stripes</Text>
          <Text style={styles.next}>Next · {nextMilestone}</Text>
        </View>
        <Text style={styles.pct}>{percent}%</Text>
      </View>

      <View style={styles.trackBar}>
        <Animated.View style={[styles.trackFill, { width: barWidth }]}>
          <LinearGradient
            colors={[palette.greenBright, palette.green, palette.greenDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View style={[styles.trackShine, { opacity: glowOpacity }]} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  beltRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  beltCase: {
    width: 96,
    height: 34,
    justifyContent: 'center',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  beltFabric: { ...StyleSheet.absoluteFill, height: 18, top: 8 },
  stripe: {
    position: 'absolute',
    top: 5,
    width: 9,
    height: 24,
    borderRadius: 2,
    backgroundColor: palette.green,
  },
  beltGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  rank: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.text },
  track: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  next: { fontFamily: fonts.medium, fontSize: 12, color: colors.textFaint, marginTop: 4 },
  pct: { fontFamily: fonts.displayBlack, fontSize: 24, color: colors.accent },
  trackBar: {
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: palette.insetStrong,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', borderRadius: radii.pill, overflow: 'hidden' },
  trackShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
