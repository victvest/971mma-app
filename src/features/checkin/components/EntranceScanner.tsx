import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  EntranceCheckedInCard,
  EntranceGuardianConfirmModal,
  EntranceScanError,
  EntranceScanSuccess,
} from '@/features/checkin/components/EntranceScanResult';
import { useEntranceCheckin } from '@/features/checkin/hooks/useEntranceCheckin';
import { readEntranceCoordinates } from '@/features/checkin/utils/entranceLocation';
import { classifyEntranceCheckInError } from '@/features/checkin/utils/checkInErrors';
import type { EntryCheckinNeedsConfirmation } from '@/features/gate/types';
import { isMemberQrToken, parseGateQrToken } from '@/services/qr/parseGateQrToken';
import { Button } from '@/shared/components/ui/Button';
import { useTheme } from '@/shared/theme';
import { PerfMark, usePerfOnceReady } from '@/shared/performance';

const SCAN_LOCK_MS = 2_000;
const INVALID_SCAN_LOCK = '__invalid__';

const CORNER_ARM = 28;
const CORNER_OFFSET = 24;
const CORNER_STROKE = 3;
const SCAN_LINE_TRAVEL = 220;

const ON_INVERSE = {
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.65)',
} as const;

type PendingScan = {
  gateToken: string;
  latitude: number;
  longitude: number;
};

type Props = {
  tabFocused: boolean;
  checkedInToday: boolean;
  checkedInAt?: string | null;
  memberName: string;
  canShowActiveQr: boolean;
};

export function EntranceScanner({
  tabFocused,
  checkedInToday,
  checkedInAt,
  memberName,
  canShowActiveQr,
}: Props) {
  const { colors, typography, inset, gap, radius } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{ title: string; message: string; actionLabel?: string; onAction?: () => void } | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);
  const [successName, setSuccessName] = useState(memberName);
  const [pendingConfirm, setPendingConfirm] = useState<EntryCheckinNeedsConfirmation | null>(null);
  const [pendingScan, setPendingScan] = useState<PendingScan | null>(null);
  const [cameraMountError, setCameraMountError] = useState<string | null>(null);
  const [locationGranted, setLocationGranted] = useState(false);

  const isBusyRef = useRef(false);
  const entranceCheckin = useEntranceCheckin();
  const scanLineY = useSharedValue(CORNER_OFFSET);
  const cameraActive =
    tabFocused &&
    canShowActiveQr &&
    !checkedInToday &&
    permission?.granted === true &&
    locationGranted &&
    !successVisible &&
    !errorState &&
    !entranceCheckin.isPending;

  useEffect(() => {
    if (!cameraActive) {
      cancelAnimation(scanLineY);
      scanLineY.value = CORNER_OFFSET;
      return;
    }

    scanLineY.value = CORNER_OFFSET;
    scanLineY.value = withRepeat(
      withTiming(CORNER_OFFSET + SCAN_LINE_TRAVEL, {
        duration: 2200,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(scanLineY);
    };
  }, [cameraActive, scanLineY]);

  useEffect(() => {
    if (!tabFocused || checkedInToday || !canShowActiveQr) {
      setLocationGranted(false);
      return;
    }

    void Location.getForegroundPermissionsAsync().then(({ status }) => {
      setLocationGranted(status === 'granted');
    });
  }, [canShowActiveQr, checkedInToday, tabFocused]);

  usePerfOnceReady(PerfMark.scannerActive, Boolean(cameraActive), { screen: 'checkin-entrance' });

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  const resetScanState = useCallback(() => {
    setLastScanned(null);
    setErrorState(null);
    setSuccessVisible(false);
    setPendingConfirm(null);
    setPendingScan(null);
    setCameraMountError(null);
    isBusyRef.current = false;
  }, []);

  useEffect(() => {
    resetScanState();
  }, [memberName, resetScanState]);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const submitCheckin = useCallback(
    async (payload: PendingScan & { confirmMinorPresent?: boolean }) => {
      const outcome = await entranceCheckin.mutateAsync({
        gateToken: payload.gateToken,
        latitude: payload.latitude,
        longitude: payload.longitude,
        confirmMinorPresent: payload.confirmMinorPresent,
      });

      if (outcome.kind === 'needs_confirmation') {
        setPendingConfirm(outcome.data);
        setPendingScan({
          gateToken: payload.gateToken,
          latitude: payload.latitude,
          longitude: payload.longitude,
        });
        return;
      }

      setSuccessName(outcome.data.memberName);
      setSuccessVisible(true);
    },
    [entranceCheckin],
  );

  const handleBarcode = useCallback(
    async ({ data }: { data: string }) => {
      if (!tabFocused || checkedInToday || lastScanned || isBusyRef.current) return;

      if (isMemberQrToken(data)) {
        setErrorState({
          title: 'Wrong QR code',
          message:
            'This is your member pass, not the entrance display. Point your camera at the QR on the tablet by the door.',
          actionLabel: 'Try again',
          onAction: resetScanState,
        });
        setLastScanned(INVALID_SCAN_LOCK);
        setTimeout(() => setLastScanned(null), SCAN_LOCK_MS);
        return;
      }

      if (!parseGateQrToken(data)) {
        setErrorState({
          title: 'Invalid QR code',
          message: 'This is not a valid 971 MMA entrance code. Scan the QR on the tablet at the gym entrance.',
          actionLabel: 'Try again',
          onAction: resetScanState,
        });
        setLastScanned(INVALID_SCAN_LOCK);
        setTimeout(() => setLastScanned(null), SCAN_LOCK_MS);
        return;
      }

      isBusyRef.current = true;
      setErrorState(null);
      setLastScanned(data);

      try {
        const coordinates = await readEntranceCoordinates();
        await submitCheckin({ gateToken: data, ...coordinates });
      } catch (error) {
        const classified = classifyEntranceCheckInError(error);
        setErrorState({
          title: classified.title,
          message: classified.message,
          actionLabel: classified.actionLabel,
          onAction: classified.onAction ?? resetScanState,
        });
      } finally {
        setTimeout(() => {
          isBusyRef.current = false;
          setLastScanned(null);
        }, SCAN_LOCK_MS);
      }
    },
    [checkedInToday, lastScanned, resetScanState, submitCheckin, tabFocused],
  );

  const handleGuardianConfirm = useCallback(async () => {
    if (!pendingScan) return;
    try {
      await submitCheckin({ ...pendingScan, confirmMinorPresent: true });
      setPendingConfirm(null);
      setPendingScan(null);
    } catch (error) {
      const classified = classifyEntranceCheckInError(error);
      setPendingConfirm(null);
      setErrorState({
        title: classified.title,
        message: classified.message,
        actionLabel: classified.actionLabel,
        onAction: classified.onAction ?? resetScanState,
      });
    }
  }, [pendingScan, resetScanState, submitCheckin]);

  const handleGuardianCancel = useCallback(() => {
    setPendingConfirm(null);
    setPendingScan(null);
    resetScanState();
  }, [resetScanState]);

  const handleRequestLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationGranted(status === 'granted');
    if (status !== 'granted') {
      setErrorState({
        title: 'Location required',
        message: 'Location access is required to verify you are at the academy.',
        actionLabel: Platform.OS === 'ios' ? 'Open Settings' : 'Try again',
        onAction: Platform.OS === 'ios' ? openSettings : resetScanState,
      });
    } else {
      resetScanState();
    }
  }, [openSettings, resetScanState]);

  const handleRequestCamera = useCallback(() => {
    void requestPermission();
  }, [requestPermission]);

  if (!canShowActiveQr) {
    return (
      <View
        style={[
          styles.lockedCard,
          {
            backgroundColor: colors.surface.primary,
            borderColor: colors.border.subtle,
            borderRadius: radius.cardLarge,
            borderWidth: 1,
            padding: inset.lg,
            gap: gap.md,
          },
        ]}
      >
        <Ionicons name="phone-portrait-outline" size={34} color={colors.accent.default} />
        <Text style={[typography.textPresets.title, { color: colors.text.primary }]} numberOfLines={2}>
          {memberName}
        </Text>
      </View>
    );
  }

  if (checkedInToday && checkedInAt) {
    return <EntranceCheckedInCard memberName={memberName} checkedInAt={checkedInAt} />;
  }

  return (
    <View
      accessibilityLabel="Scan entrance QR code"
      style={[
        styles.card,
        {
          borderRadius: radius.cardLarge,
          backgroundColor: colors.background.inverse,
          borderColor: colors.border.onPromo,
          borderWidth: 1,
          overflow: 'hidden',
        },
      ]}
    >
      <View style={[styles.cameraContainer, { minHeight: 420 }]}>
        {cameraActive ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcode}
            onMountError={(event) => setCameraMountError(event.message)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background.inverse }]} />
        )}

        {cameraActive ? (
          <View style={styles.scanFrame} pointerEvents="none">
            <View style={[styles.cornerTL, { borderColor: colors.accent.default }]} />
            <View style={[styles.cornerTR, { borderColor: colors.accent.default }]} />
            <View style={[styles.cornerBL, { borderColor: colors.accent.default }]} />
            <View style={[styles.cornerBR, { borderColor: colors.accent.default }]} />
            <Animated.View
              style={[
                styles.scanLine,
                scanLineStyle,
                { backgroundColor: colors.accent.default, shadowColor: colors.accent.default },
              ]}
            />
          </View>
        ) : null}

        {!permission?.granted && !errorState && !entranceCheckin.isPending ? (
          <View style={[StyleSheet.absoluteFill, styles.centered, { padding: inset.lg, gap: gap.md }]}>
            <Ionicons name="camera-outline" size={40} color={colors.accent.default} />
            <Text style={[typography.textPresets.bodyStrong, { color: ON_INVERSE.text, textAlign: 'center' }]}>
              Camera access is needed to scan the entrance QR code.
            </Text>
            <Button label="Allow camera" onPress={handleRequestCamera} variant="secondary" full={false} />
          </View>
        ) : null}

        {permission?.granted && !locationGranted && !errorState && !entranceCheckin.isPending ? (
          <View style={[StyleSheet.absoluteFill, styles.centered, { padding: inset.lg, gap: gap.md }]}>
            <Ionicons name="location-outline" size={40} color={colors.accent.default} />
            <Text style={[typography.textPresets.bodyStrong, { color: ON_INVERSE.text, textAlign: 'center' }]}>
              Location access verifies you are at the academy when you scan.
            </Text>
            <Button label="Allow location" onPress={() => void handleRequestLocation()} variant="secondary" full={false} />
          </View>
        ) : null}

        {entranceCheckin.isPending ? (
          <View style={[StyleSheet.absoluteFill, styles.centered, { gap: gap.sm }]}>
            <ActivityIndicator color={colors.accent.default} size="large" />
            <Text style={[typography.textPresets.bodyMedium, { color: ON_INVERSE.muted }]}>
              Checking you in…
            </Text>
          </View>
        ) : null}

        {errorState ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background.inverse }]}>
            <EntranceScanError
              title={errorState.title}
              message={errorState.message}
              actionLabel={errorState.actionLabel}
              onAction={errorState.onAction}
            />
          </View>
        ) : null}

        {cameraMountError && !errorState ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background.inverse }]}>
            <EntranceScanError
              title="Camera unavailable"
              message={cameraMountError}
              actionLabel="Try again"
              onAction={resetScanState}
            />
          </View>
        ) : null}

        <EntranceScanSuccess
          memberName={successName}
          visible={successVisible}
          onDismiss={resetScanState}
        />
      </View>

      {!errorState && !successVisible && permission?.granted && locationGranted && !entranceCheckin.isPending ? (
        <View style={{ padding: inset.md, paddingTop: 0 }}>
          <Text style={[typography.textPresets.footnote, { color: ON_INVERSE.muted, textAlign: 'center' }]}>
            Point at the QR on the entrance tablet
          </Text>
        </View>
      ) : null}

      <EntranceGuardianConfirmModal
        pending={pendingConfirm}
        busy={entranceCheckin.isPending}
        onConfirm={() => void handleGuardianConfirm()}
        onCancel={handleGuardianCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 420,
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedCard: {
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  cornerTL: {
    position: 'absolute',
    top: CORNER_OFFSET,
    left: CORNER_OFFSET,
    width: CORNER_ARM,
    height: CORNER_ARM,
    borderTopWidth: CORNER_STROKE,
    borderLeftWidth: CORNER_STROKE,
  },
  cornerTR: {
    position: 'absolute',
    top: CORNER_OFFSET,
    right: CORNER_OFFSET,
    width: CORNER_ARM,
    height: CORNER_ARM,
    borderTopWidth: CORNER_STROKE,
    borderRightWidth: CORNER_STROKE,
  },
  cornerBL: {
    position: 'absolute',
    bottom: CORNER_OFFSET,
    left: CORNER_OFFSET,
    width: CORNER_ARM,
    height: CORNER_ARM,
    borderBottomWidth: CORNER_STROKE,
    borderLeftWidth: CORNER_STROKE,
  },
  cornerBR: {
    position: 'absolute',
    bottom: CORNER_OFFSET,
    right: CORNER_OFFSET,
    width: CORNER_ARM,
    height: CORNER_ARM,
    borderBottomWidth: CORNER_STROKE,
    borderRightWidth: CORNER_STROKE,
  },
  scanLine: {
    position: 'absolute',
    left: CORNER_OFFSET + 8,
    right: CORNER_OFFSET + 8,
    height: 2,
    opacity: 0.85,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});
