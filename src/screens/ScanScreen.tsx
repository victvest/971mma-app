import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, motion, palette, radii, spacing, typography, brand } from '../theme';
import { GlassNavBar } from '../components/GlassNavBar';
import { ScreenShell } from '../components/ScreenShell';
import { MemberPassCard } from '../components/MemberPassCard';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Button } from '../components/Button';
import { membership } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { checkIns } from '../services/integrations';
import { buildMemberQrToken } from '../services/qrToken';

type Mode = 'pass' | 'scan';

function formatExpiry(iso: string | null): string {
  if (!iso) return membership.renewsOn;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return membership.renewsOn;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function ScanScreen() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [mode, setMode] = useState<Mode>('pass');
  const [permission, requestPermission] = useCameraPermissions();
  const [checkedIn, setCheckedIn] = useState(false);
  const scanLock = useRef(false);
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mode === 'scan' && !checkedIn) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 2400,
            easing: motion.easing.inOut,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [mode, checkedIn, scanAnim]);

  const handleScanned = async () => {
    if (scanLock.current) return;
    scanLock.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCheckedIn(true);
    try {
      await checkIns.recordCheckIn({ classId: null, method: 'qr' });
    } catch {
      /* keep success UX for demo */
    }
  };

  const reset = () => {
    scanLock.current = false;
    setCheckedIn(false);
  };

  const seed = buildMemberQrToken(user?.id ?? membership.memberId, 'supabase');
  const displayName =
    profile?.fullName || (user?.user_metadata as any)?.full_name || user?.email?.split('@')[0] || 'Member';
  const tier = (profile?.membershipTier ?? 'elite') as 'standard' | 'pro' | 'elite';

  return (
    <ScreenShell>
      <StatusBar style="dark" />
      <GlassNavBar title="Member pass" subtitle="Earn Your Level · show at reception" showBell={false} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.segment}>
          <SegBtn label="My pass" icon="qr-code" active={mode === 'pass'} onPress={() => setMode('pass')} />
          <SegBtn label="Scan gym code" icon="scan" active={mode === 'scan'} onPress={() => setMode('scan')} />
        </View>

        {mode === 'pass' ? (
          <>
            <MemberPassCard
              seed={seed}
              name={displayName}
              memberId={membership.memberId}
              plan={membership.plan}
              status={membership.status}
              tier={tier}
              expiresLabel={formatExpiry(profile?.membershipExpiresAt ?? null)}
            />
            <View style={styles.tips}>
              <Tip icon="sunny-outline" text="Increase screen brightness for faster scanning" />
              <Tip icon="walk-outline" text="Walk in anytime — no class booking needed" />
            </View>
          </>
        ) : checkedIn ? (
          <SuccessView onDone={reset} />
        ) : (
          <ScanView
            permission={permission}
            requestPermission={requestPermission}
            onScanned={handleScanned}
            scanAnim={scanAnim}
          />
        )}
      </ScrollView>
    </ScreenShell>
  );
}

function SegBtn({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.segBtn}>
      {active ? (
        <LinearGradient colors={[...brand.cta]} style={styles.segFill}>
          <Ionicons name={icon} size={17} color="#fff" />
          <Text style={[styles.segText, { color: '#fff' }]}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.segIdle}>
          <Ionicons name={icon} size={17} color={colors.textMuted} />
          <Text style={[styles.segText, { color: colors.textMuted }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function Tip({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.tip}>
      <Ionicons name={icon} size={16} color={colors.accent} />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

function ScanView({
  permission,
  requestPermission,
  onScanned,
  scanAnim,
}: {
  permission: ReturnType<typeof useCameraPermissions>[0];
  requestPermission: () => void;
  onScanned: () => void;
  scanAnim: Animated.Value;
}) {
  if (!permission) return <View style={styles.scanFrame} />;

  if (!permission.granted) {
    return (
      <View style={styles.permWrap}>
        <View style={styles.permIcon}>
          <Ionicons name="camera-outline" size={32} color={colors.accent} />
        </View>
        <Text style={styles.permTitle}>Camera access</Text>
        <Text style={styles.permText}>Allow camera to scan the check-in QR at the gym entrance.</Text>
        <Button label="Enable camera" icon="camera" onPress={requestPermission} full={false} style={{ marginTop: spacing.xl }} />
        <Pressable onPress={onScanned} style={styles.simBtn} accessibilityRole="button">
          <Text style={styles.simText}>Simulate scan</Text>
        </Pressable>
      </View>
    );
  }

  const translateY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 234] });

  return (
    <View style={styles.scanWrap}>
      <View style={styles.scanFrame}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onScanned}
        />
        <View style={styles.scanOverlay}>
          <Corner pos={{ top: 0, left: 0 }} r={{ borderTopLeftRadius: 18 }} />
          <Corner pos={{ top: 0, right: 0 }} r={{ borderTopRightRadius: 18 }} />
          <Corner pos={{ bottom: 0, left: 0 }} r={{ borderBottomLeftRadius: 18 }} />
          <Corner pos={{ bottom: 0, right: 0 }} r={{ borderBottomRightRadius: 18 }} />
          <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]}>
            <LinearGradient
              colors={['transparent', palette.greenBright, palette.green, 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.scanGrad}
            />
          </Animated.View>
        </View>
      </View>
      <Text style={styles.scanHint}>Point at the gym check-in code</Text>
      <Pressable onPress={onScanned} style={styles.simBtn} accessibilityRole="button">
        <Text style={styles.simText}>Simulate scan</Text>
      </Pressable>
    </View>
  );
}

function Corner({ pos, r }: { pos: object; r: object }) {
  return <View style={[styles.corner, pos, r]} />;
}

function SuccessView({ onDone }: { onDone: () => void }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(24)).current;
  const streak = membership.streakDays + 1;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, ...motion.springBounce }),
        Animated.timing(fade, { toValue: 1, duration: motion.duration.normal, easing: motion.easing.out, useNativeDriver: true }),
      ]),
      Animated.spring(rise, { toValue: 0, ...motion.springSoft }),
    ]).start();
  }, [fade, rise, scale]);

  return (
    <Animated.View style={[styles.successWrap, { opacity: fade }]}>
      <Animated.View style={[styles.successIcon, { transform: [{ scale }] }]}>
        <LinearGradient colors={[...brand.cta]} style={styles.successFill}>
          <Ionicons name="checkmark" size={56} color="#fff" />
        </LinearGradient>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateY: rise }] }}>
        <Text style={styles.successTitle}>You're checked in</Text>
        <Text style={styles.successText}>Walk onto the mat — session added to your history.</Text>
        <View style={styles.successCard}>
          <Ionicons name="flame" size={18} color={palette.red} />
          <AnimatedNumber value={streak} style={styles.successStreakNum} />
          <Text style={styles.successStreakLabel}>day streak</Text>
        </View>
      </Animated.View>
      <Button label="Done" onPress={onDone} style={{ marginTop: spacing.xxl }} full={false} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 140 },
  segment: {
    flexDirection: 'row',
    backgroundColor: palette.inset,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    padding: 4,
    marginBottom: spacing.xl,
    gap: 4,
  },
  segBtn: { flex: 1 },
  segFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: radii.pill,
  },
  segIdle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: radii.pill,
  },
  segText: { fontFamily: fonts.semi, fontSize: 14 },
  tips: { marginTop: spacing.xl, gap: spacing.md },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, flex: 1 },
  scanWrap: { alignItems: 'center', paddingTop: spacing.lg },
  scanFrame: {
    width: 280,
    height: 280,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: palette.black,
    borderWidth: 1,
    borderColor: palette.greenLine,
  },
  scanOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, margin: 14 },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: colors.accent, borderWidth: 3 },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 3 },
  scanGrad: { flex: 1, borderRadius: 2 },
  scanHint: { marginTop: spacing.xl, fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  permWrap: { alignItems: 'center', paddingTop: spacing.huge },
  permIcon: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: palette.greenGlass,
    borderWidth: 1,
    borderColor: palette.greenLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permTitle: { ...typography.h2, color: colors.text, marginTop: spacing.xl },
  permText: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.xl },
  simBtn: { marginTop: spacing.xl, padding: spacing.sm },
  simText: { color: colors.textFaint, fontFamily: fonts.semi, fontSize: 13, textDecorationLine: 'underline' },
  successWrap: { alignItems: 'center', paddingTop: spacing.xxl },
  successIcon: { width: 112, height: 112, borderRadius: 56, overflow: 'hidden' },
  successFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  successTitle: { ...typography.h1, color: colors.text, marginTop: spacing.xl },
  successText: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    backgroundColor: palette.redGlass,
    borderWidth: 1,
    borderColor: palette.redLine,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
  },
  successStreakNum: { color: palette.red, fontFamily: fonts.displayBold, fontSize: 14 },
  successStreakLabel: { color: palette.red, fontFamily: fonts.semi, fontSize: 14 },
});
