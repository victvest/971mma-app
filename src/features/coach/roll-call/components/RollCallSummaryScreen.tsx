import React, { memo, useCallback, useMemo, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RollCallSummaryStats } from '@/features/coach/roll-call/components/RollCallSummaryStats';
import { RollCallStatusChip } from '@/features/coach/roll-call/components/RollCallStatusChip';
import {
  useCompleteRollCall,
  useRollCallState,
} from '@/features/coach/roll-call/hooks/useRollCall';
import { useRollCallDeckMarking } from '@/features/coach/roll-call/hooks/useRollCallDeckMarking';
import { flushPendingRollCallMarks } from '@/features/coach/roll-call/utils/flushPendingRollCallMarks';
import { useQueryClient } from '@tanstack/react-query';
import type { RollCallDeckMember } from '@/features/coach/roll-call/types';
import {
  DEFAULT_ROLL_CALL_CONFIG,
  rollCallStatusDisplayLabel,
} from '@/features/coach/roll-call/types';
import {
  openRollCallScanner,
  returnToRunClassHub,
} from '@/features/coach/roll-call/utils/rollCallNavigation';
import { resolveRollCallMemberAvatar } from '@/features/coach/roll-call/utils/rollCallAvatarUrl';
import { initialsFromName } from '@/features/onboarding/services/onboardingValidation';
import { StateBlock } from '@/shared/components/StateBlock';
import { AppBar, AppBarIconButton, Button, FlashListScrollComponent } from '@/shared/components/ui';
import {
  FLASH_LIST_ESTIMATES,
  flashListOverrideItemLayout,
} from '@/shared/constants/flashListEstimates';
import { useDialog } from '@/shared/components/Dialog/useDialog';
import { triggerLightImpact, triggerSuccessNotification } from '@/shared/haptics';
import { isRollCallSessionCompleted } from '@/features/coach/roll-call/utils/rollCallSession';
import { resolveRollCallSummary } from '@/features/coach/roll-call/utils/resolveRollCallSummary';
import { useTheme } from '@/shared/theme';
import { toUserFacingErrorMessage, USER_FACING_NETWORK_ERROR } from '@/lib/userFacingError';

type Props = {
  classId: string;
};

type AttendanceSide = 'present' | 'absent';

type SummaryRowProps = {
  member: RollCallDeckMember;
  editable: boolean;
  disabled?: boolean;
  onChangeStatus?: (member: RollCallDeckMember, status: AttendanceSide) => void;
};

function resolveAttendanceSide(member: RollCallDeckMember): AttendanceSide | null {
  const status = member.mark?.status;
  if (!status) return null;
  if (status === 'present' || status === 'late') return 'present';
  if (status === 'absent') return 'absent';
  return null;
}

const RollCallSummaryAvatar = memo(function RollCallSummaryAvatar({
  member,
}: {
  member: RollCallDeckMember;
}) {
  const { colors, radius, typography } = useTheme();
  const initials = useMemo(() => initialsFromName(member.displayName), [member.displayName]);
  const avatarUrl = useMemo(() => resolveRollCallMemberAvatar(member), [member]);

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={member.deckKey}
        style={[
          styles.avatar,
          {
            borderRadius: radius.pill,
            backgroundColor: colors.fill.secondary,
          },
        ]}
        accessibilityLabel={`${member.displayName} photo`}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatar,
        styles.avatarFallback,
        {
          borderRadius: radius.pill,
          backgroundColor: colors.accent.subtle,
        },
      ]}
    >
      <Text style={[typography.textPresets.bodyStrong, { color: colors.accent.default }]}>
        {initials}
      </Text>
    </View>
  );
});

const AttendanceRadio = memo(function AttendanceRadio({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors, typography, radius, inset } = useTheme();

  return (
    <Pressable
      onPress={() => {
        if (disabled || selected) return;
        triggerLightImpact();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.radioChip,
        {
          borderRadius: radius.pill,
          borderColor: selected ? colors.accent.default : colors.border.default,
          backgroundColor: selected ? colors.accent.subtle : colors.surface.primary,
          paddingHorizontal: inset.sm,
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.radioOuter,
          {
            borderColor: selected ? colors.accent.default : colors.border.default,
          },
        ]}
      >
        {selected ? (
          <View style={[styles.radioInner, { backgroundColor: colors.accent.default }]} />
        ) : null}
      </View>
      <Text
        style={[
          typography.textPresets.captionMedium,
          { color: selected ? colors.accent.default : colors.text.secondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

const RollCallSummaryRow = memo(function RollCallSummaryRow({
  member,
  editable,
  disabled = false,
  onChangeStatus,
}: SummaryRowProps) {
  const { colors, typography, inset, gap, radii: radiiTokens } = useTheme();
  const side = useMemo(() => resolveAttendanceSide(member), [member]);
  const statusLabel = member.mark ? rollCallStatusDisplayLabel(member.mark.status) : 'Not marked';
  const statusColor =
    side === 'absent'
      ? colors.status.error
      : side === 'present'
        ? colors.accent.default
        : colors.text.tertiary;
  const presenceChip = member.hasFacilityCheckInToday
    ? ('at_academy' as const)
    : member.isWalkIn
      ? null
      : ('not_here' as const);

  return (
    <View
      style={[
        styles.row,
        {
          borderRadius: radiiTokens.sm,
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          padding: inset.md,
          gap: gap.sm,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${member.displayName}, ${statusLabel}${
        presenceChip === 'not_here'
          ? ', Not here'
          : presenceChip === 'at_academy'
            ? ', Checked In'
            : ''
      }`}
    >
      <RollCallSummaryAvatar member={member} />
      <View style={styles.rowMain}>
        <View style={[styles.nameRow, { gap: gap.xs }]}>
          <Text
            style={[typography.textPresets.bodyStrong, styles.nameText, { color: colors.text.primary }]}
            numberOfLines={1}
          >
            {member.displayName}
          </Text>
          {presenceChip ? <RollCallStatusChip variant={presenceChip} /> : null}
        </View>
        {member.mark?.method === 'qr_scan' ? (
          <Text
            style={[
              typography.textPresets.captionMedium,
              { color: colors.accent.default, marginTop: 2 },
            ]}
          >
            QR code
          </Text>
        ) : null}
        {editable ? (
          <View style={[styles.radioRow, { gap: gap.sm, marginTop: 8 }]}>
            <AttendanceRadio
              label="Present"
              selected={side === 'present'}
              disabled={disabled}
              onPress={() => onChangeStatus?.(member, 'present')}
            />
            <AttendanceRadio
              label="Absent"
              selected={side === 'absent'}
              disabled={disabled}
              onPress={() => onChangeStatus?.(member, 'absent')}
            />
          </View>
        ) : (
          <Text style={[typography.textPresets.captionMedium, { color: statusColor, marginTop: 2 }]}>
            {statusLabel}
          </Text>
        )}
      </View>
    </View>
  );
});

export function RollCallSummaryScreen({ classId }: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { colors, typography, inset, gap } = useTheme();
  const { showAlert, showConfirm, showDialog, hideDialog } = useDialog();
  const rollCallQuery = useRollCallState(classId);
  const completeMutation = useCompleteRollCall(classId);
  const { recordWithStatus, handleRecordError, isRecording } = useRollCallDeckMarking(
    classId,
    rollCallQuery.data?.config ?? DEFAULT_ROLL_CALL_CONFIG,
  );
  const [isFlushing, setIsFlushing] = useState(false);

  const deck = rollCallQuery.data?.deck ?? [];
  const summary = useMemo(() => {
    const data = rollCallQuery.data;
    if (!data) return undefined;

    return resolveRollCallSummary({
      deck: data.deck,
      config: data.config,
    });
  }, [rollCallQuery.data]);
  const session = rollCallQuery.data?.session ?? null;
  const isCompleted = isRollCallSessionCompleted(session);
  const canEdit = !isCompleted;

  const members = useMemo(
    () =>
      [...deck].sort((a, b) => {
        if (a.hasFacilityCheckInToday !== b.hasFacilityCheckInToday) {
          return a.hasFacilityCheckInToday ? -1 : 1;
        }
        return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
      }),
    [deck],
  );

  const handleChangeStatus = useCallback(
    (member: RollCallDeckMember, status: AttendanceSide) => {
      if (!canEdit) return;
      void recordWithStatus(member, status).catch(handleRecordError);
    },
    [canEdit, handleRecordError, recordWithStatus],
  );

  const renderItem = useCallback(
    ({ item }: { item: RollCallDeckMember }) => (
      <RollCallSummaryRow
        member={item}
        editable={canEdit}
        disabled={isRecording || completeMutation.isPending}
        onChangeStatus={handleChangeStatus}
      />
    ),
    [canEdit, completeMutation.isPending, handleChangeStatus, isRecording],
  );

  const keyExtractor = useCallback((item: RollCallDeckMember) => item.deckKey, []);

  const handleBackPress = useCallback(() => {
    // Never return to the swipe deck from summary — edits happen with radios here.
    returnToRunClassHub(classId);
  }, [classId]);

  const openScanner = useCallback(() => {
    triggerLightImpact();
    openRollCallScanner(classId, 'swiper');
  }, [classId]);

  const handleMenuPress = useCallback(() => {
    if (!canEdit) return;

    showDialog({
      title: 'Roll call actions',
      message: 'Scan another member onto this class list.',
      dismissOnBackdropPress: true,
      buttons: [
        {
          label: 'Scan QR',
          variant: 'primary',
          onPress: () => {
            hideDialog();
            openScanner();
          },
        },
        {
          label: 'Cancel',
          variant: 'secondary',
        },
      ],
    });
  }, [canEdit, hideDialog, openScanner, showDialog]);

  const submitAttendance = useCallback(async () => {
    if (!session?.id) {
      showAlert('No active session', 'Go back to roll call and try again.');
      return;
    }

    try {
      setIsFlushing(true);
      await flushPendingRollCallMarks(queryClient, classId);
      await completeMutation.mutateAsync(session.id);
      triggerSuccessNotification();
      returnToRunClassHub(classId);
    } catch (error) {
      showAlert(
        'Could not submit attendance',
        toUserFacingErrorMessage(error, { fallback: USER_FACING_NETWORK_ERROR }),
      );
    } finally {
      setIsFlushing(false);
    }
  }, [classId, completeMutation, queryClient, session?.id, showAlert]);

  const handleConfirmAttendance = useCallback(() => {
    if (!session?.id) {
      showAlert('No active session', 'Go back to roll call and try again.');
      return;
    }

    showConfirm(
      'Confirm attendance?',
      'This locks today’s marks for this class. You will not be able to change them after submitting.',
      () => {
        void submitAttendance();
      },
      { confirmLabel: 'Confirm attendance', cancelLabel: 'Cancel' },
    );
  }, [session?.id, showAlert, showConfirm, submitAttendance]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBackPress();
        return true;
      });
      return () => subscription.remove();
    }, [handleBackPress]),
  );

  const isInitialLoad = rollCallQuery.isPending;

  if (isInitialLoad) {
    return (
      <View
        style={[styles.safe, { backgroundColor: colors.background.primary, padding: inset.lg }]}
      >
        <StateBlock kind="loading" title="Loading summary" />
      </View>
    );
  }

  if (rollCallQuery.isError || !summary) {
    const message = toUserFacingErrorMessage(rollCallQuery.error, {
      fallback: USER_FACING_NETWORK_ERROR,
    });

    return (
      <View
        style={[styles.safe, { backgroundColor: colors.background.primary, padding: inset.lg }]}
      >
        <StateBlock
          kind="error"
          title="Could not load summary"
          message={message}
          actionLabel="Retry"
          onAction={() => {
            void rollCallQuery.refetch();
          }}
          offlineAwareRetry
        />
      </View>
    );
  }

  const isBusy = completeMutation.isPending || isRecording || isFlushing;
  const footerPaddingBottom = insets.bottom + inset.md;

  return (
    <View
      style={[
        styles.safe,
        {
          backgroundColor: colors.background.primary,
          paddingTop: insets.top,
        },
      ]}
    >
      <AppBar
        title={isCompleted ? 'Attendance history' : 'Roll call summary'}
        showBackButton
        onBackPress={handleBackPress}
        titleNumberOfLines={2}
        rightElement={
          canEdit ? (
            <AppBarIconButton
              icon="ellipsis-horizontal"
              accessibilityLabel="More actions"
              onPress={handleMenuPress}
            />
          ) : undefined
        }
      />

      <View style={styles.listWrap}>
        <FlashList
          data={members}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          overrideItemLayout={flashListOverrideItemLayout(FLASH_LIST_ESTIMATES.rollCallSummaryRow)}
          renderScrollComponent={FlashListScrollComponent}
          contentContainerStyle={{
            paddingTop: inset.lg,
            paddingHorizontal: inset.lg,
            paddingBottom: footerPaddingBottom + 168,
          }}
          ItemSeparatorComponent={SummaryRowSeparator}
          ListHeaderComponent={
            <View style={{ gap: gap.lg, paddingBottom: gap.md }}>
              <RollCallSummaryStats summary={summary} />
              <View style={styles.sectionHeader}>
                <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
                  {canEdit ? 'Adjust marks' : 'Marked members'}
                </Text>
                <Text
                  style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}
                >
                  {members.length} member{members.length === 1 ? '' : 's'}
                </Text>
              </View>
              {canEdit ? (
                <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
                  Tap Present or Absent to fix a mark before you confirm.
                </Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <StateBlock
              kind="empty"
              title="No members yet"
              message={
                canEdit
                  ? 'Scan member QR codes to build this class list.'
                  : 'No attendance was recorded for this class.'
              }
            />
          }
        />
      </View>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.surface.primary,
            borderTopColor: colors.border.subtle,
            paddingHorizontal: inset.lg,
            paddingTop: inset.md,
            paddingBottom: footerPaddingBottom,
            gap: gap.sm,
          },
        ]}
      >
        {canEdit ? (
          <View style={[styles.footerActions, { gap: gap.sm }]}>
            <Button
              label="Scan QR"
              variant="outline"
              icon="qr-code-outline"
              onPress={openScanner}
              disabled={isBusy}
            />
            <Button
              label="Confirm attendance"
              icon="checkmark-circle"
              onPress={handleConfirmAttendance}
              loading={completeMutation.isPending}
              disabled={isBusy}
            />
          </View>
        ) : (
          <Button
            label="Back to class"
            variant="secondary"
            onPress={() => returnToRunClassHub(classId)}
          />
        )}
      </View>
    </View>
  );
}

function SummaryRowSeparator() {
  const { gap } = useTheme();
  return <View style={{ height: gap.sm }} />;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  listWrap: {
    flex: 1,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footer: {
    backgroundColor: 'transparent',
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  footerActions: {
    alignSelf: 'stretch',
    flexDirection: 'column',
    width: '100%',
  },
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  nameText: {
    flexShrink: 1,
    minWidth: 0,
  },
  radioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  radioChip: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    minHeight: 32,
  },
  radioOuter: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  radioInner: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  avatar: {
    height: 48,
    width: 48,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
