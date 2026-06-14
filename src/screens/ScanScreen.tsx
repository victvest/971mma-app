import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, glow, palette, radii, spacing, typography } from '../theme';
import { AppHeader } from '../components/AppHeader';
import { AuroraBackground } from '../components/AuroraBackground';
import { GlassSurface } from '../components/GlassSurface';
import { QrCode } from '../components/QrCode';
import { Button } from '../components/Button';
import { membership } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { checkIns } from '../services/integrations';
import { buildMemberQrToken } from '../services/qrToken';

type Mode = 'pass' | 'scan';

export function ScanScreen() {
  const { user } = useAuth();
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
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [mode, checkedIn, scanAnim]);

  const handleScanned = () => {
    if (scanLock.current) return;
    scanLock.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCheckedIn(true);
    checkIns.recordCheckIn({ classId: null, method: 'qr' }).catch(() => {});
  };

  const reset = () => {
    scanLock.current = false;
    setCheckedIn(false);
  };

  const seed = buildMemberQrToken(user?.id ?? membership.memberId, 'supabase');

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AuroraBackground tone="green" />
      <AppHeader title="Check in" subtitle="Scan to enter" showBell={false} />

      <View style={styles.body}>
        <View style={styles.segment}>
          <SegBtn label="My Pass" icon="qr-code-outline" active={mode === 'pass'} onPress={() => setMode('pass')} />
          <SegBtn label="Scan" icon="scan-outline" active={mode === 'scan'} onPress={() => setMode('scan')} />
        </View>

        {mode === 'pass' ? (
          <PassView seed={seed} name={(user?.user_metadata as any)?.full_name ?? user?.email} />
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
      </View>
    </View>
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
        <LinearGradient
          colors={[palette.greenBright, palette.green]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.segFill, glow.green]}
        >
          <Ionicons name={icon} size={16} color="#04150C" />
          <Text style={[styles.segText, { color: '#04150C' }]}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.segIdle}>
          <Ionicons name={icon} size={16} color={colors.textMuted} />
          <Text style={[styles.segText, { color: colors.textMuted }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function PassView({ seed, name }: { seed: string; name?: string }) {
  return (
    <View style={styles.passWrap}>
      <GlassSurface strong tone="green" radius={radii.xl} style={[styles.passCard, glow.green]} padding={spacing.xl}>
        <View style={styles.passHeader}>
          <View>
            <Text style={styles.passLabel}>MEMBER PASS</Text>
            <Text style={styles.passName}>{name ?? 'Member'}</Text>
          </View>
          <View style={styles.passStatus}>
            <View style={styles.statusDot} />
            <Text style={styles.passStatusText}>{membership.status}</Text>
          </View>
        </View>

        <View style={styles.qrFrame}>
          <QrCode seed={seed} size={196} />
        </View>

        <Text style={styles.passHint}>Show this at the front desk to check in</Text>

        <View style={styles.passFooter}>
          <View style={styles.passFootCol}>
            <Text style={styles.passFootLabel}>Member ID</Text>
            <Text style={styles.passFootValue}>{membership.memberId}</Text>
          </View>
          <View style={styles.passDivider} />
          <View style={styles.passFootCol}>
            <Text style={styles.passFootLabel}>Plan</Text>
            <Text style={styles.passFootValue}>{membership.plan}</Text>
          </View>
        </View>
      </GlassSurface>
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
  if (!permission) {
    return <View style={styles.scanFrame} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permWrap}>
        <View style={styles.permIcon}>
          <Ionicons name="camera-outline" size={32} color={colors.accentBright} />
        </View>
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permText}>
          Allow camera access to scan the 971 MMA check-in code at the gym entrance.
        </Text>
        <Button label="Enable camera" icon="camera" onPress={requestPermission} full={false} style={{ marginTop: spacing.xl }} />
        <Pressable onPress={onScanned} style={styles.simBtn} accessibilityRole="button">
          <Text style={styles.simText}>Simulate a scan</Text>
        </Pressable>
      </View>
    );
  }

  const translateY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 234] });

  return (
    <View style={styles.scanWrap}>
      <View style={[styles.scanFrame, glow.green]}>
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
          <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
        </View>
      </View>
      <Text style={styles.scanHint}>Point at the check-in QR code</Text>
      <Pressable onPress={onScanned} style={styles.simBtn} accessibilityRole="button">
        <Text style={styles.simText}>Simulate a scan</Text>
      </Pressable>
    </View>
  );
}

function Corner({ pos, r }: { pos: object; r: object }) {
  return <View style={[styles.corner, pos, r]} />;
}

function SuccessView({ onDone }: { onDone: () => void }) {
  return (
    <View style={styles.successWrap}>
      <View style={[styles.successIcon, glow.green]}>
        <LinearGradient
          colors={[palette.greenBright, palette.green]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.successFill}
        >
          <Ionicons name="checkmark" size={56} color="#04150C" />
        </LinearGradient>
      </View>
      <Text style={styles.successTitle}>You're checked in</Text>
      <Text style={styles.successText}>BJJ Fundamentals · 18:00 · Coach Tony</Text>
      <View style={styles.successCard}>
        <Ionicons name="flame" size={18} color={palette.redBright} />
        <Text style={styles.successStreak}>{membership.streakDays + 1} day streak · keep the momentum</Text>
      </View>
      <Button label="Done" onPress={onDone} style={{ marginTop: spacing.xxl }} full={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.md },

  segment: {
    flexDirection: 'row',
    backgroundColor: palette.glass06,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    padding: 5,
    marginBottom: spacing.xxl,
    gap: 5,
  },
  segBtn: { flex: 1 },
  segFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: radii.pill,
  },
  segIdle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: radii.pill,
  },
  segText: { fontFamily: fonts.bold, fontSize: 14 },

  passWrap: { alignItems: 'center' },
  passCard: { width: '100%', alignItems: 'center' },
  passHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.xl,
  },
  passLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.6, color: colors.textFaint },
  passName: { ...typography.h3, color: colors.text, marginTop: 4 },
  passStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.greenGlass,
    borderWidth: 1,
    borderColor: palette.greenLine,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accentBright },
  passStatusText: { color: colors.accentBright, fontFamily: fonts.bold, fontSize: 12 },
  qrFrame: {
    padding: spacing.lg,
    backgroundColor: '#fff',
    borderRadius: radii.lg,
  },
  passHint: { marginTop: spacing.lg, fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  passFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    width: '100%',
  },
  passFootCol: { alignItems: 'center' },
  passDivider: { width: 1, height: 30, backgroundColor: colors.border },
  passFootLabel: { fontFamily: fonts.semi, fontSize: 11, color: colors.textFaint, letterSpacing: 0.4 },
  passFootValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, marginTop: 2 },

  scanWrap: { alignItems: 'center' },
  scanFrame: {
    width: 260,
    height: 260,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: palette.black,
    borderWidth: 1,
    borderColor: palette.greenLine,
  },
  scanOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, margin: 14 },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: colors.accentBright, borderWidth: 4 },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: colors.accentBright,
    shadowColor: colors.accentBright,
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
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
  permText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  simBtn: { marginTop: spacing.xl, padding: spacing.sm },
  simText: { color: colors.textFaint, fontFamily: fonts.bold, fontSize: 13, textDecorationLine: 'underline' },

  successWrap: { alignItems: 'center', paddingTop: spacing.xxl },
  successIcon: { width: 112, height: 112, borderRadius: 56, overflow: 'hidden' },
  successFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  successTitle: { ...typography.h1, color: colors.text, marginTop: spacing.xl },
  successText: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    backgroundColor: palette.redGlass,
    borderWidth: 1,
    borderColor: 'rgba(255,59,78,0.35)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
  },
  successStreak: { color: palette.redBright, fontFamily: fonts.semi, fontSize: 13.5 },
});
