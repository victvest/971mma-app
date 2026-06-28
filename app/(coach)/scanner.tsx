import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  useRecordRollCallMark,
  useRollCallState,
  useStartRollCall,
} from '@/features/coach/roll-call/hooks/useRollCall';
import { coachRosterKey } from '@/features/coach/hooks/useCoachMode';
import { isRollCallSessionCompleted } from '@/features/coach/roll-call/utils/rollCallSession';
import { fetchClassRoster } from '@/services/database/coach.repository';
import { parseMemberQrToken } from '@/services/qr/token';
import { AppBar, NativeButton } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';
import { PerfMark, usePerfOnceReady } from '@/shared/performance';

const INVALID_SCAN_LOCK = '__invalid__';

const CORNER_ARM = 28;
const CORNER_OFFSET = 24;
const CORNER_STROKE = 3;

type ScanSuccess = {
  memberName: string;
};

function formatScanError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Check your connection and try again.';
}

/** Roll-call backup only — opened from Run Class with a required classId. */
export default function CoachRollCallScannerScreen() {
  const { colors, typography, inset, gap, radius } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { classId } = useLocalSearchParams<{ classId?: string }>();
  const resolvedClassId = typeof classId === 'string' ? classId : null;
  const screenTitle = 'Scan QR';

  const [isFocused, setIsFocused] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraMountError, setCameraMountError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [invalidQrMessage, setInvalidQrMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<ScanSuccess | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const startRollCallMutation = useStartRollCall(resolvedClassId);
  const recordMarkMutation = useRecordRollCallMark(resolvedClassId);
  const rollCallQuery = useRollCallState(resolvedClassId);
  const isBusyRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      setLastScanned(null);
      setInvalidQrMessage(null);
      setScanError(null);
      setScanSuccess(null);
      setCameraMountError(null);
      isBusyRef.current = false;
      return () => setIsFocused(false);
    }, []),
  );

  const scannerActive = isFocused && permission?.granted === true && !cameraMountError;
  usePerfOnceReady(PerfMark.scannerActive, scannerActive, {
    screen: 'coach-scanner',
    classId: resolvedClassId,
  });

  const handleReset = useCallback(() => {
    setLastScanned(null);
    setInvalidQrMessage(null);
    setScanError(null);
    setScanSuccess(null);
    setCameraMountError(null);
    isBusyRef.current = false;
  }, []);

  const handleBarcode = useCallback(
    async ({ data }: { data: string }) => {
      if (!resolvedClassId || lastScanned || isBusyRef.current) return;

      const ref = parseMemberQrToken(data);
      if (!ref) {
        setInvalidQrMessage(
          'This is not a valid 971 MMA member code. Ask them to open Check-in and show their QR pass.',
        );
        setLastScanned(INVALID_SCAN_LOCK);
        return;
      }

      isBusyRef.current = true;
      setInvalidQrMessage(null);
      setScanError(null);
      setScanSuccess(null);
      setLastScanned(ref.memberId);
      setIsSaving(true);

      try {
        let state = rollCallQuery.data;
        if (!state) {
          state = await rollCallQuery.refetch().then((result) => result.data);
        }

        if (isRollCallSessionCompleted(state?.session ?? null)) {
          throw new Error('Roll call is already complete for this class.');
        }

        if (!state?.session || state.session.status === 'draft') {
          await startRollCallMutation.mutateAsync();
          state = await rollCallQuery.refetch().then((result) => result.data);
        }

        const deckMember =
          state?.deck.find((item) => item.userId === ref.memberId) ??
          state?.deck.find((item) => item.deckKey === ref.memberId);

        if (deckMember?.mark?.status === 'present' || deckMember?.mark?.status === 'late') {
          setScanSuccess({ memberName: deckMember.displayName });
          return;
        }

        let userId = deckMember?.userId ?? ref.memberId;
        let mindbodyClientId = deckMember?.mindbodyClientId ?? '';
        let displayName = deckMember?.displayName ?? '';

        if (!deckMember) {
          const roster = await queryClient.fetchQuery({
            queryKey: coachRosterKey(resolvedClassId),
            queryFn: () => fetchClassRoster(resolvedClassId),
          });
          const visitor = roster.visitors.find((item) => item.userId === ref.memberId);
          if (!visitor?.userId) {
            throw new Error('This member is not on this class roster.');
          }
          userId = visitor.userId;
          mindbodyClientId = visitor.mindbodyClientId;
          displayName = visitor.name;
        }

        await recordMarkMutation.mutateAsync({
          userId,
          mindbodyClientId,
          status: 'present',
          method: 'qr_scan',
        });

        setScanSuccess({ memberName: displayName || 'Member' });
      } catch (error) {
        setScanError(formatScanError(error));
        setLastScanned(null);
      } finally {
        setIsSaving(false);
        isBusyRef.current = false;
      }
    },
    [
      lastScanned,
      queryClient,
      recordMarkMutation,
      resolvedClassId,
      rollCallQuery,
      startRollCallMutation,
    ],
  );

  if (!resolvedClassId) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background.primary }]}
        edges={['top']}
      >
        <AppBar title={screenTitle} showBackButton />
        <View style={[styles.centered, { padding: inset.lg }]}>
          <StateBlock
            kind="error"
            title="Open from a class"
            message="Scan QR is a roll call backup. Start from Run Class first."
            actionLabel="Back"
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background.primary }]}
        edges={['top']}
      >
        <AppBar title={screenTitle} showBackButton />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent.default} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background.primary }]}
        edges={['top']}
      >
        <AppBar title={screenTitle} showBackButton />
        <View style={[styles.centered, { padding: inset.lg, gap: gap.md }]}>
          <View
            style={[
              styles.permissionIcon,
              {
                backgroundColor: colors.fill.secondary,
                borderRadius: radius.cardLarge,
              },
            ]}
          >
            <Ionicons name="camera-outline" size={40} color={colors.text.secondary} />
          </View>
          <Text
            style={[
              typography.textPresets.callout,
              { color: colors.text.primary, textAlign: 'center' },
            ]}
          >
            Camera access needed
          </Text>
          <Text
            style={[
              typography.textPresets.body,
              { color: colors.text.secondary, textAlign: 'center' },
            ]}
          >
            Camera access is required to scan member QR codes for class attendance.
          </Text>
          <NativeButton label="Grant camera access" onPress={requestPermission} full />
        </View>
      </SafeAreaView>
    );
  }

  const errorMessage = cameraMountError ?? invalidQrMessage ?? scanError;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top']}
    >
      <AppBar title={screenTitle} showBackButton />

      <View style={[styles.content, { paddingHorizontal: inset.lg, paddingBottom: inset.lg }]}>
        <View
          style={[
            styles.cameraContainer,
            {
              borderRadius: radius.cardLarge,
              marginTop: inset.md,
            },
          ]}
          accessibilityLabel="Class attendance QR scanner"
          accessibilityHint="Point the camera at the member's QR pass from their app"
        >
          {isFocused ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              active={isFocused}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={lastScanned || isSaving ? undefined : handleBarcode}
              onMountError={(event) => {
                setCameraMountError(
                  event.message || 'Camera could not start. Go back and try again.',
                );
              }}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.fill.primary }]} />
          )}

          <View style={styles.scanFrame} pointerEvents="none">
            <View style={[styles.cornerTL, { borderColor: colors.accent.default }]} />
            <View style={[styles.cornerTR, { borderColor: colors.accent.default }]} />
            <View style={[styles.cornerBL, { borderColor: colors.accent.default }]} />
            <View style={[styles.cornerBR, { borderColor: colors.accent.default }]} />
          </View>
        </View>

        {scanSuccess ? (
          <View
            style={[
              styles.feedback,
              {
                backgroundColor: colors.status.successSubtle,
                borderColor: colors.status.successBorder,
                borderRadius: radius.card,
                padding: inset.md,
                marginTop: inset.md,
                gap: gap.sm,
                alignItems: 'center',
              },
            ]}
          >
            <View style={[styles.checkRow, { gap: gap.sm }]}>
              <Ionicons name="checkmark-circle" size={22} color={colors.status.success} />
              <Text style={[typography.textPresets.bodyStrong, { color: colors.status.success }]}>
                {scanSuccess.memberName} attended this class
              </Text>
            </View>
            <Pressable onPress={handleReset} style={styles.textAction}>
              <Text style={[typography.textPresets.bodyMedium, { color: colors.accent.default }]}>
                Scan another
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!scanSuccess && errorMessage ? (
          <View
            style={[
              styles.feedback,
              {
                backgroundColor: colors.status.errorSubtle,
                borderColor: colors.status.errorBorder,
                borderRadius: radius.card,
                padding: inset.md,
                marginTop: inset.md,
                gap: gap.sm,
                alignItems: 'center',
              },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={22} color={colors.status.error} />
            <Text
              style={[
                typography.textPresets.bodyStrong,
                { color: colors.status.error, textAlign: 'center' },
              ]}
            >
              {errorMessage}
            </Text>
            <Pressable onPress={handleReset} style={styles.textAction}>
              <Text style={[typography.textPresets.bodyMedium, { color: colors.accent.default }]}>
                Try again
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!scanSuccess && !errorMessage && isSaving ? (
          <View
            style={[
              styles.feedback,
              {
                marginTop: inset.md,
                padding: inset.md,
                alignItems: 'center',
                gap: gap.sm,
              },
            ]}
          >
            <ActivityIndicator color={colors.accent.default} />
            <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
              Marking class attendance…
            </Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  permissionIcon: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraContainer: {
    flex: 1,
    minHeight: 280,
    overflow: 'hidden',
    position: 'relative',
  },
  scanFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  feedback: { borderWidth: 1 },
  textAction: { paddingVertical: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center' },
});
