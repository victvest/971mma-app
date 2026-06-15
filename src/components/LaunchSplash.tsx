import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from './Logo';
import { colors, fonts, palette, radii, spacing } from '../theme';

const heroImg = require('../../assets/images/hero-bjj.jpg');

type Props = {
  message?: string;
};

/** Coach-on-mat hero splash with "Earn Your Level" — first screen on open. */
export function LaunchSplash({ message = 'Preparing your member hub…' }: Props) {
  const insets = useSafeAreaInsets();
  const heroFade = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(1.08)).current;
  const cardSlide = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const taglineScale = useRef(new Animated.Value(0.92)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(heroScale, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(cardSlide, {
        toValue: 0,
        damping: 18,
        stiffness: 140,
        delay: 320,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 600,
        delay: 320,
        useNativeDriver: true,
      }),
      Animated.spring(taglineScale, {
        toValue: 1,
        damping: 12,
        stiffness: 100,
        delay: 520,
        useNativeDriver: true,
      }),
    ]).start();

    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    shimmerLoop.start();
    return () => shimmerLoop.stop();
  }, [cardOpacity, cardSlide, heroFade, heroScale, shimmer, taglineScale]);

  const shimmerX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-140, 140],
  });

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.heroWrap, { opacity: heroFade, transform: [{ scale: heroScale }] }]}>
        <Image source={heroImg} style={styles.hero} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(4,8,6,0.15)', 'rgba(4,8,6,0.45)', 'rgba(241,244,242,0.92)', palette.ink900]}
          locations={[0, 0.42, 0.78, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.logoBadge}>
          <Logo size={28} tint="white" />
        </View>
        <Text style={styles.topBrand}>971 MMA</Text>
      </View>

      <Animated.View
        style={[
          styles.card,
          {
            opacity: cardOpacity,
            transform: [{ translateY: cardSlide }],
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: taglineScale }] }}>
          <Text style={styles.earn}>
            Earn Your <Text style={styles.earnAccent}>Level</Text>
          </Text>
          <Text style={styles.earnSub}>Show up. Train hard. Rise through the ranks.</Text>
        </Animated.View>

        <Text style={styles.message}>{message}</Text>

        <View style={styles.track}>
          <Animated.View style={[styles.shimmerWrap, { transform: [{ translateX: shimmerX }] }]}>
            <LinearGradient
              colors={['transparent', palette.greenBright, palette.green, palette.red, 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.shimmer}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.ink900 },
  heroWrap: { ...StyleSheet.absoluteFill },
  hero: { width: '100%', height: '100%' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBrand: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    color: '#fff',
    letterSpacing: 0.6,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  earn: {
    fontFamily: fonts.displayBlack,
    fontSize: 38,
    color: colors.text,
    letterSpacing: 0.4,
    lineHeight: 40,
  },
  earnAccent: {
    color: palette.red,
  },
  earnSub: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  message: {
    fontFamily: fonts.semi,
    fontSize: 13,
    color: colors.textFaint,
    marginTop: spacing.xl,
  },
  track: {
    marginTop: spacing.lg,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: palette.insetStrong,
    overflow: 'hidden',
  },
  shimmerWrap: { width: '45%', height: '100%' },
  shimmer: { flex: 1, borderRadius: radii.pill },
});
