import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Logo } from './Logo';
import { ScreenShell } from './ScreenShell';
import { colors, fonts, palette, radii, spacing } from '../theme';

type Props = {
  message?: string;
};

/** Premium boot / auth splash — logo reveal, glass ring, shimmer bar. */
export function LaunchSplash({ message = 'Loading your pass…' }: Props) {
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const ringSpin = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        damping: 14,
        stiffness: 120,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 680,
        delay: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    const spinLoop = Animated.loop(
      Animated.timing(ringSpin, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ringPulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );

    spinLoop.start();
    pulseLoop.start();
    shimmerLoop.start();

    return () => {
      spinLoop.stop();
      pulseLoop.stop();
      shimmerLoop.stop();
    };
  }, [logoOpacity, logoScale, ringPulse, ringSpin, shimmer, textOpacity]);

  const spin = ringSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const ringScale = ringPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const ringOpacity = ringPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });
  const shimmerX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120],
  });

  return (
    <ScreenShell style={styles.root}>
      <View style={styles.center}>
        <Animated.View style={[styles.glow, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />

        <Animated.View style={[styles.ringOuter, { transform: [{ rotate: spin }, { scale: ringScale }], opacity: ringOpacity }]}>
          <LinearGradient
            colors={[palette.greenBright, palette.green, 'transparent', palette.red, palette.redDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ringGrad}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.logoShell,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.72)']}
            style={styles.logoGlass}
          >
            <Logo size={72} tint="black" />
          </LinearGradient>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, { opacity: textOpacity }]}>
        <Text style={styles.brand}>971 MMA</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.shimmerWrap, { transform: [{ translateX: shimmerX }] }]}>
            <LinearGradient
              colors={['transparent', palette.greenBright, palette.green, 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.shimmer}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </ScreenShell>
  );
}

const RING = 148;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    width: RING + 40,
    height: RING + 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: RING + 24,
    height: RING + 24,
    borderRadius: (RING + 24) / 2,
    backgroundColor: palette.greenGlass,
  },
  ringOuter: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    padding: 3,
    overflow: 'hidden',
  },
  ringGrad: {
    flex: 1,
    borderRadius: RING / 2,
    opacity: 0.9,
  },
  logoShell: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.greenLine,
    shadowColor: '#16271D',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  logoGlass: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 72,
    alignItems: 'center',
    width: '72%',
  },
  brand: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    color: colors.text,
    letterSpacing: 0.4,
  },
  message: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  track: {
    marginTop: spacing.lg,
    width: '100%',
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: palette.insetStrong,
    overflow: 'hidden',
  },
  shimmerWrap: {
    width: '50%',
    height: '100%',
  },
  shimmer: {
    flex: 1,
    borderRadius: radii.pill,
  },
});
