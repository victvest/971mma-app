import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, motion, palette, radii, shadow, spacing } from '../theme';
import { Logo } from './Logo';
import { QrCode } from './QrCode';
import { UaeFlagStripe } from './UaeAccent';

type Props = {
  seed: string;
  name: string;
  memberId: string;
  plan: string;
  status?: string;
  tier?: 'standard' | 'pro' | 'elite';
  expiresLabel?: string;
};

const TIER_GRAD: Record<NonNullable<Props['tier']>, readonly [string, string, ...string[]]> = {
  standard: [palette.greenDeep, palette.green, palette.greenBright],
  pro: [palette.greenDeep, '#1A5C40', palette.greenBright],
  elite: [palette.goldDeep, palette.gold, palette.goldBright],
};

const TIER_ON: Record<NonNullable<Props['tier']>, { text: string; muted: string }> = {
  standard: { text: '#EAFBF1', muted: 'rgba(234,251,241,0.75)' },
  pro: { text: '#EAFBF1', muted: 'rgba(234,251,241,0.75)' },
  elite: { text: '#1B1403', muted: 'rgba(27,20,3,0.68)' },
};

/** Premium digital wallet pass — holographic sheen, live QR chamber, elite header. */
export function MemberPassCard({
  seed,
  name,
  memberId,
  plan,
  status = 'Active',
  tier = 'elite',
  expiresLabel,
}: Props) {
  const on = TIER_ON[tier];
  const enter = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const ringSpin = useRef(new Animated.Value(0)).current;
  const [tick, setTick] = useState(() => new Date());

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, ...motion.spring }).start();

    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 4200,
        easing: motion.easing.inOut,
        useNativeDriver: true,
      }),
    );
    const ringLoop = Animated.loop(
      Animated.timing(ringSpin, {
        toValue: 1,
        duration: 14000,
        easing: motion.easing.inOut,
        useNativeDriver: true,
      }),
    );
    shimmerLoop.start();
    ringLoop.start();

    const clock = setInterval(() => setTick(new Date()), 30_000);
    return () => {
      shimmerLoop.stop();
      ringLoop.stop();
      clearInterval(clock);
    };
  }, [enter, ringSpin, shimmer]);

  const cardScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  const cardOpacity = enter.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-240, 360] });
  const ringRotate = ringSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const timeStr = tick.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <Animated.View style={[styles.shell, shadow.floating, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
      <View style={styles.card}>
        {/* Header band */}
        <View style={styles.header}>
          <LinearGradient colors={TIER_GRAD[tier]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
            style={styles.headerSheen}
            pointerEvents="none"
          />
          <View style={styles.headerRow}>
            <View style={styles.brandRow}>
              <Logo size={28} tint={tier === 'elite' ? 'black' : 'white'} />
              <View>
                <Text style={[styles.brand, { color: on.text }]}>971 MMA</Text>
                <Text style={[styles.brandSub, { color: on.muted }]}>Member pass</Text>
              </View>
            </View>
            <View style={[styles.tierPill, tier === 'elite' && styles.tierPillElite]}>
              <Text style={[styles.tierText, { color: on.text }]}>{plan.split(' ').pop()}</Text>
            </View>
          </View>
          <Text style={[styles.memberName, { color: on.text }]} numberOfLines={1}>{name}</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={[styles.statusText, { color: on.text }]}>{status}</Text>
            <Text style={[styles.liveTime, { color: on.muted }]}>· Live {timeStr}</Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          <Animated.View style={[styles.holoShine, { transform: [{ translateX: shimmerX }, { rotate: '-16deg' }] }]} pointerEvents="none">
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <View style={styles.qrStage}>
            <Animated.View style={[styles.qrRing, { transform: [{ rotate: ringRotate }] }]}>
              <LinearGradient
                colors={[palette.greenBright, palette.green, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.qrRingGrad}
              />
            </Animated.View>
            <View style={styles.qrChamber}>
              <View style={styles.qrInner}>
                <QrCode seed={seed} size={210} />
              </View>
            </View>
          </View>

          <View style={styles.scanHint}>
            <Ionicons name="scan-outline" size={18} color={colors.accent} />
            <Text style={styles.scanText}>Hold up at reception to check in</Text>
          </View>

          <View style={styles.metaGrid}>
            <MetaCell label="Member ID" value={memberId} />
            <MetaCell label="Plan" value={plan} />
            <MetaCell label="Valid" value={expiresLabel ?? '—'} />
          </View>

          <View style={styles.secureRow}>
            <Ionicons name="shield-checkmark" size={14} color={colors.textFaint} />
            <Text style={styles.secureText}>Encrypted member token · refreshes automatically</Text>
          </View>
        </View>

        <UaeFlagStripe thickness={4} style={styles.accentStrip} />
      </View>
    </Animated.View>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { width: '100%', borderRadius: radii.xxl, overflow: 'hidden' },
  card: {
    borderRadius: radii.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.hairlineStrong,
    backgroundColor: palette.white,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    overflow: 'hidden',
  },
  headerSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '60%' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brand: { fontFamily: fonts.displayBold, fontSize: 18, letterSpacing: 0.4 },
  brandSub: { fontFamily: fonts.medium, fontSize: 11, marginTop: 1 },
  tierPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  tierPillElite: { backgroundColor: 'rgba(27,20,3,0.15)', borderColor: 'rgba(27,20,3,0.25)' },
  tierText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6 },
  memberName: {
    fontFamily: fonts.displayBlack,
    fontSize: 28,
    marginTop: spacing.lg,
    letterSpacing: 0.2,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: 6 },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7DFFB0',
  },
  statusText: { fontFamily: fonts.semi, fontSize: 13 },
  liveTime: { fontFamily: fonts.medium, fontSize: 12 },
  body: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.92)',
    overflow: 'hidden',
  },
  holoShine: {
    position: 'absolute',
    top: -40,
    width: 100,
    height: 400,
    opacity: 0.7,
    overflow: 'hidden',
  },
  qrStage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  qrRing: {
    position: 'absolute',
    width: 252,
    height: 252,
    borderRadius: 126,
    padding: 3,
    overflow: 'hidden',
  },
  qrRingGrad: { flex: 1, borderRadius: 126 },
  qrChamber: {
    padding: 6,
    borderRadius: radii.xl,
    backgroundColor: palette.inset,
    borderWidth: 1,
    borderColor: palette.greenLine,
  },
  qrInner: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: '#fff',
    ...shadow.soft,
  },
  scanHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  scanText: { fontFamily: fonts.semi, fontSize: 14, color: colors.textMuted },
  metaGrid: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  metaCell: {
    flex: 1,
    backgroundColor: palette.inset,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  metaLabel: { fontFamily: fonts.medium, fontSize: 10, color: colors.textFaint, letterSpacing: 0.3 },
  metaValue: { fontFamily: fonts.semi, fontSize: 12, color: colors.text, marginTop: 4, textAlign: 'center' },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.lg,
  },
  secureText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textFaint },
  accentStrip: { height: 4 },
});
