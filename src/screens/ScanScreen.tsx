import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, palette, radii, shadow, spacing, typography } from '../theme';
import { AppHeader } from '../components/AppHeader';
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
    // Persist the check-in. Failures (e.g. mock/offline) are non-blocking so the
    // success UI still shows during review.
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
      <AppHeader title="Check in" subtitle="Scan to enter" showBell={false} />

      <View style={styles.body}>
        {/* Segmented toggle */}
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
    <Pressable onPress={onPress} style={[styles.segBtn, active && styles.segBtnActive]}>
      <Ionicons name={icon} size={16} color={active ? '#fff' : colors.textMuted} />
      <Text style={[styles.segText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

function PassView({ seed, name }: { seed: string; name?: string }) {
  return (
    <View style={styles.passWrap}>
      <View style={styles.passCard}>
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
          <View>
            <Text style={styles.passFootLabel}>Member ID</Text>
            <Text style={styles.passFootValue}>{membership.memberId}</Text>
          </View>
          <View style={styles.passDivider} />
          <View>
            <Text style={styles.passFootLabel}>Plan</Text>
            <Text style={styles.passFootValue}>{membership.plan}</Text>
          </View>
        </View>
      </View>
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
          <Ionicons name="camera-outline" size={32} color={colors.accent} />
        </View>
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permText}>
          Allow camera access to scan the 971 MMA check-in code at the gym entrance.
        </Text>
        <Button label="Enable camera" icon="camera" onPress={requestPermission} full={false} style={{ marginTop: spacing.xl }} />
        <Pressable onPress={onScanned} style={styles.simBtn}>
          <Text style={styles.simText}>Simulate a scan</Text>
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
          <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
        </View>
      </View>
      <Text style={styles.scanHint}>Point at the check-in QR code</Text>
      <Pressable onPress={onScanned} style={styles.simBtn}>
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
      <View style={styles.successIcon}>
        <Ionicons name="checkmark" size={56} color="#fff" />
      </View>
      <Text style={styles.successTitle}>You're checked in</Text>
      <Text style={styles.successText}>BJJ Fundamentals · 18:00 · Coach Tony</Text>
      <View style={styles.successCard}>
        <Ionicons name="flame" size={18} color={colors.danger} />
        <Text style={styles.successStreak}>
          {membership.streakDays + 1} day streak · keep the momentum
        </Text>
      </View>
      <Button label="Done" onPress={onDone} style={{ marginTop: spacing.xxl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.pill,
    padding: 4,
    marginBottom: spacing.xxl,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: radii.pill,
  },
  segBtnActive: { backgroundColor: colors.accent, ...shadow.soft },
  segText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },

  passWrap: { alignItems: 'center' },
  passCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow.card,
  },
  passHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.xl,
  },
  passLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: colors.textFaint },
  passName: { ...typography.h3, color: colors.text, marginTop: 4 },
  passStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  passStatusText: { color: colors.accent, fontWeight: '800', fontSize: 12 },
  qrFrame: {
    padding: spacing.lg,
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passHint: { marginTop: spacing.lg, fontSize: 13, color: colors.textMuted, fontWeight: '600' },
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
  passDivider: { width: 1, height: 30, backgroundColor: colors.border },
  passFootLabel: { fontSize: 11, color: colors.textFaint, fontWeight: '700', letterSpacing: 0.4 },
  passFootValue: { fontSize: 14, color: colors.text, fontWeight: '800', marginTop: 2 },

  scanWrap: { alignItems: 'center' },
  scanFrame: {
    width: 260,
    height: 260,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: palette.black,
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
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  scanHint: { marginTop: spacing.xl, fontSize: 14, color: colors.textMuted, fontWeight: '600' },

  permWrap: { alignItems: 'center', paddingTop: spacing.huge },
  permIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
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
  simText: { color: colors.textFaint, fontWeight: '700', fontSize: 13, textDecorationLine: 'underline' },

  successWrap: { alignItems: 'center', paddingTop: spacing.xxl },
  successIcon: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  successTitle: { ...typography.h1, color: colors.text, marginTop: spacing.xl },
  successText: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
  },
  successStreak: { color: colors.danger, fontWeight: '700', fontSize: 13.5 },
});
