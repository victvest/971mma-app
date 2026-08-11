import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useConfirmRollCallScan,
  useRollCallState,
  useAddRollCallClassMember,
} from '@/features/coach/roll-call/hooks/useRollCall';
import { RollCallScanConfirmSheet } from '@/features/coach/roll-call/components/RollCallScanConfirmSheet';
import { RollCallScanFeedback } from '@/features/coach/roll-call/components/RollCallScanFeedback';
import type { RollCallMemberPreview, RollCallPreviewResult } from '@/features/coach/roll-call/types';
import { closeRollCallScanner } from '@/features/coach/roll-call/utils/rollCallNavigation';
import { getRollCallMemberPreview } from '@/services/database/rollCall.repository';
import { parseMemberQrToken } from '@/services/qr/token';
import { AppBar, Button } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';
import { PerfMark, usePerfOnceReady } from '@/shared/performance';
import { triggerSuccessNotification } from '@/shared/haptics';
import { toUserFacingErrorMessage, USER_FACING_SAVE_ERROR } from '@/lib/userFacingError';
import { toast } from '@/shared/components/Toast';

const CORNER_ARM = 28;
const CORNER_OFFSET = 24;
const CORNER_STROKE = 3;

type ScanPhase =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'confirm'; member: RollCallMemberPreview }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'success'; memberName: string };

function previewFailure(result: Extract<RollCallPreviewResult, { ok: false }>): ScanPhase {
  return {
    kind: 'error',
    code: result.code,
    message: toUserFacingErrorMessage(result.message, {
      fallback: 'We could not look up this member. Try scanning again.',
    }),
  };
}

/** Roll-call QR add — opened from Run Class / Roll Call with a required classId. */
export default function CoachRollCallScannerScreen() {
  const { colors, typography, inset, gap, radius } = useTheme();
  const { classId, source } = useLocalSearchParams<{ classId?: string; source?: string }>();
  const resolvedClassId = typeof classId === 'string' ? classId : null;
  const isFromRunClass = source === 'run_class';
  const screenTitle = 'Scan QR';

  const [isFocused, setIsFocused] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraMountError, setCameraMountError] = useState<string | null>(null);
  const [phase, setPhase] = useState<ScanPhase>({ kind: 'idle' });
  const confirmScanMutation = useConfirmRollCallScan(resolvedClassId);
  const addMemberMutation = useAddRollCallClassMember(resolvedClassId);
  const rollCallQuery = useRollCallState(resolvedClassId);
  const isBusyRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      setCameraReady(false);
      setPhase({ kind: 'idle' });
      setCameraMountError(null);
      isBusyRef.current = false;
      // Defer CameraView until after the transition so Android surface attach
      // does not race the previous screen's native teardown.
      const task = InteractionManager.runAfterInteractions(() => {
        setCameraReady(true);
      });
      return () => {
        task.cancel();
        setIsFocused(false);
        setCameraReady(false);
      };
    }, []),
  );

  const scannerActive =
    isFocused &&
    cameraReady &&
    permission?.granted === true &&
    !cameraMountError &&
    phase.kind === 'idle';
  usePerfOnceReady(PerfMark.scannerActive, scannerActive, {
    screen: 'coach-scanner',
    classId: resolvedClassId,
  });

  const handleReset = useCallback(() => {
    setPhase({ kind: 'idle' });
    setCameraMountError(null);
    isBusyRef.current = false;
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (phase.kind !== 'confirm' || !resolvedClassId) return;
    const member = phase.member;
    try {
      if (isFromRunClass) {
        await addMemberMutation.mutateAsync({ userId: member.userId, preview: member });
        triggerSuccessNotification();
        toast.success('Member added', `${member.fullName} was added to the swiper deck.`);
        closeRollCallScanner(resolvedClassId);
      } else {
        await confirmScanMutation.mutateAsync(member);
        triggerSuccessNotification();
        setPhase({ kind: 'success', memberName: member.fullName });
        void rollCallQuery.refetch();
      }
    } catch (error) {
      setPhase({
        kind: 'error',
        code: 'SAVE_FAILED',
        message: toUserFacingErrorMessage(error, {
          fallback: 'Could not save this member. Check your connection and try again.',
        }),
      });
    }
  }, [
    phase,
    resolvedClassId,
    isFromRunClass,
    addMemberMutation,
    confirmScanMutation,
    rollCallQuery,
  ]);

  const handleBarcode = useCallback(
    async ({ data }: { data: string }) => {
      if (!resolvedClassId || phase.kind !== 'idle' || isBusyRef.current) return;

      const ref = parseMemberQrToken(data);
      if (!ref) {
        setPhase({
          kind: 'error',
          code: 'INVALID_QR',
          message:
            'This is not a valid 971 MMA member code. Ask them to open Check-in and show their QR pass.',
        });
        return;
      }

      if (ref.source !== 'supabase') {
        setPhase({
          kind: 'error',
          code: 'INVALID_QR',
          message: 'Ask them to open Check-in in the 971 MMA app and show their QR pass.',
        });
        return;
      }

      isBusyRef.current = true;
      setPhase({ kind: 'resolving' });

      try {
        const preview = await getRollCallMemberPreview(ref.memberId);
        if (!preview.ok || !preview.member) {
          if (!preview.ok) {
            setPhase(previewFailure(preview));
            return;
          }
          setPhase({
            kind: 'error',
            code: 'UNKNOWN_MEMBER',
            message: 'We could not find this member in the academy app.',
          });
          return;
        }
        setPhase({ kind: 'confirm', member: preview.member });
      } catch {
        setPhase({
          kind: 'error',
          code: 'UNKNOWN_MEMBER',
          message: 'We could not look up this member. Try scanning again.',
        });
      } finally {
        isBusyRef.current = false;
      }
    },
    [phase.kind, resolvedClassId],
  );

  const goToRunClass = useCallback(() => {
    closeRollCallScanner(resolvedClassId);
  }, [resolvedClassId]);

  if (!resolvedClassId) {
    return (
      <AppSafeAreaView
        style={[styles.safe, { backgroundColor: colors.background.primary }]}
        edges={['top']}
      >
        <AppBar title={screenTitle} showBackButton onBackPress={goToRunClass} />
        <View style={[styles.centered, { padding: inset.lg }]}>
          <StateBlock
            kind="error"
            title="Open from a class"
            message="Scan QR adds members to that class list. Start from Run Class or Roll Call first."
            actionLabel="Back"
            onAction={goToRunClass}
          />
        </View>
      </AppSafeAreaView>
    );
  }

  if (!permission) {
    return (
      <AppSafeAreaView
        style={[styles.safe, { backgroundColor: colors.background.primary }]}
        edges={['top']}
      >
        <AppBar title={screenTitle} showBackButton onBackPress={goToRunClass} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent.default} />
        </View>
      </AppSafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <AppSafeAreaView
        style={[styles.safe, { backgroundColor: colors.background.primary }]}
        edges={['top']}
      >
        <AppBar title={screenTitle} showBackButton onBackPress={goToRunClass} />
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
            Camera access is required to scan member QR codes for class roll call.
          </Text>
          <Button label="Grant camera access" onPress={requestPermission} full />
        </View>
      </AppSafeAreaView>
    );
  }

  const showCamera = phase.kind === 'idle' || phase.kind === 'resolving';

  return (
    <AppSafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top']}
    >
      <AppBar title={screenTitle} showBackButton onBackPress={goToRunClass} />

      {phase.kind === 'error' ? (
        <RollCallScanFeedback
          code={phase.code}
          message={phase.message}
          onTryAgain={handleReset}
        />
      ) : null}

      {phase.kind === 'success' ? (
        <View style={[styles.centered, { paddingHorizontal: inset.xl, gap: gap.md }]}>
          <View
            style={[
              styles.permissionIcon,
              {
                backgroundColor: colors.status.successSubtle,
                borderRadius: 999,
              },
            ]}
          >
            <Ionicons name="checkmark" size={36} color={colors.status.success} />
          </View>
          <Text
            style={[
              typography.textPresets.subtitle,
              { color: colors.text.primary, textAlign: 'center' },
            ]}
          >
            {phase.memberName} is present
          </Text>
          <Text
            style={[
              typography.textPresets.body,
              { color: colors.text.secondary, textAlign: 'center' },
            ]}
          >
            Saved on this class list for next time.
          </Text>
          <Button label="Scan another" onPress={handleReset} full />
          <Button
            label="Back to run class"
            variant="outline"
            onPress={goToRunClass}
            full
          />
        </View>
      ) : null}

      {showCamera ? (
        <View style={[styles.content, { paddingHorizontal: inset.lg, paddingBottom: inset.lg }]}>
          <View
            style={[
              styles.cameraContainer,
              {
                borderRadius: radius.cardLarge,
                marginTop: inset.md,
              },
            ]}
            accessibilityLabel="Class roll call QR scanner"
            accessibilityHint="Point the camera at the member's QR pass from their app"
          >
            {isFocused && cameraReady ? (
              <CameraView
                style={StyleSheet.absoluteFill}
                active={isFocused && cameraReady}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={phase.kind === 'idle' ? handleBarcode : undefined}
                onMountError={(event) => {
                  setCameraMountError(
                    toUserFacingErrorMessage(event.message, {
                      fallback: 'Camera could not start. Go back and try again.',
                    }),
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

          {cameraMountError ? (
            <Text
              style={[
                typography.textPresets.body,
                { color: colors.status.error, textAlign: 'center', marginTop: inset.md },
              ]}
            >
              {cameraMountError}
            </Text>
          ) : (
            <Text
              style={[
                typography.textPresets.footnote,
                {
                  color: colors.text.secondary,
                  textAlign: 'center',
                  marginTop: inset.md,
                },
              ]}
            >
              {phase.kind === 'resolving'
                ? 'Looking up member…'
                : 'Point at their Check-in QR pass'}
            </Text>
          )}

          {phase.kind === 'resolving' ? (
            <ActivityIndicator
              color={colors.accent.default}
              style={{ marginTop: inset.md }}
            />
          ) : null}
        </View>
      ) : null}

      <RollCallScanConfirmSheet
        visible={phase.kind === 'confirm'}
        member={phase.kind === 'confirm' ? phase.member : null}
        isConfirming={isFromRunClass ? addMemberMutation.isPending : confirmScanMutation.isPending}
        onDismiss={handleReset}
        onConfirm={handleConfirmAction}
        confirmLabel={isFromRunClass ? 'Add member to swiper' : 'Confirm present'}
      />
    </AppSafeAreaView>
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
});
