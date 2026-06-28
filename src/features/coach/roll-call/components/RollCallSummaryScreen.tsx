import React, { memo, useCallback, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RollCallSummaryHeader } from '@/features/coach/roll-call/components/RollCallSummaryHeader';
import { RollCallSummaryStats } from '@/features/coach/roll-call/components/RollCallSummaryStats';
import {
  useCompleteRollCall,
  useRollCallState,
} from '@/features/coach/roll-call/hooks/useRollCall';
import type { RollCallDeckMember } from '@/features/coach/roll-call/types';
import { rollCallStatusDisplayLabel } from '@/features/coach/roll-call/types';
import {
  COACH_HOME_PATH,
  rollCallClassHubPath,
  rollCallDeckPath,
} from '@/features/coach/roll-call/utils/rollCallNavigation';
import { resolveRollCallMemberAvatar } from '@/features/coach/roll-call/utils/rollCallAvatarUrl';
import { formatRollCallSummarySubtitle } from '@/features/coach/utils/classDisplay';
import { initialsFromName } from '@/features/onboarding/services/onboardingValidation';
import { NAV_CHROME } from '@/features/home/components/navigation/uaeChrome';
import { StateBlock } from '@/shared/components/StateBlock';
import { Button, FlashListScrollComponent } from '@/shared/components/ui';
import { useDialog } from '@/shared/components/Dialog/useDialog';
import { AppStatusBar } from '@/shared/components/AppStatusBar';
import { triggerLightImpact, triggerSuccessNotification } from '@/shared/haptics';
import { isRollCallSessionCompleted } from '@/features/coach/roll-call/utils/rollCallSession';
import { useTheme } from '@/shared/theme';

type Props = {
  classId: string;
};

type SummaryRowProps = {
  member: RollCallDeckMember;
};

const LATE_STATUS_COLOR = '#F59E0B';

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

const RollCallSummaryRow = memo(function RollCallSummaryRow({ member }: SummaryRowProps) {
  const { colors, typography, inset, gap, radii: radiiTokens } = useTheme();
  const statusLabel = member.mark ? rollCallStatusDisplayLabel(member.mark.status) : 'Not marked';
  const statusColor =
    member.mark?.status === 'late'
      ? LATE_STATUS_COLOR
      : member.mark?.status === 'absent'
        ? colors.status.error
        : colors.accent.default;

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
      accessibilityLabel={`${member.displayName}, ${statusLabel}`}
    >
      <RollCallSummaryAvatar member={member} />
      <View style={styles.rowMain}>
        <Text
          style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}
          numberOfLines={1}
        >
          {member.displayName}
        </Text>
        <Text style={[typography.textPresets.captionMedium, { color: statusColor, marginTop: 2 }]}>
          {statusLabel}
        </Text>
      </View>
    </View>
  );
});

export function RollCallSummaryScreen({ classId }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, typography, inset, gap } = useTheme();
  const { showAlert, showDialog, hideDialog } = useDialog();
  const rollCallQuery = useRollCallState(classId);
  const completeMutation = useCompleteRollCall(classId);

  const deck = rollCallQuery.data?.deck ?? [];
  const summary = rollCallQuery.data?.summary;
  const session = rollCallQuery.data?.session ?? null;
  const classTitle = rollCallQuery.data?.classTitle ?? 'Class roll call';
  const startsAt = rollCallQuery.data?.startsAt ?? '';
  const isCompleted = isRollCallSessionCompleted(session);

  const headerTopInset = insets.top;
  const headerHeight = NAV_CHROME.topInset + NAV_CHROME.clusterHeight;
  const contentTopInset = headerTopInset + headerHeight + inset.lg;

  const subtitle = useMemo(
    () => formatRollCallSummarySubtitle(classTitle, startsAt),
    [classTitle, startsAt],
  );

  const attendedMembers = useMemo(
    () =>
      deck
        .filter((member) => member.mark?.status === 'present' || member.mark?.status === 'late')
        .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })),
    [deck],
  );

  const renderItem = useCallback(
    ({ item }: { item: RollCallDeckMember }) => <RollCallSummaryRow member={item} />,
    [],
  );

  const keyExtractor = useCallback((item: RollCallDeckMember) => item.deckKey, []);

  const handleBackPress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (isCompleted) {
      router.replace(COACH_HOME_PATH);
      return;
    }
    router.replace(rollCallClassHubPath(classId));
  }, [classId, isCompleted, router]);

  const openScanner = useCallback(() => {
    triggerLightImpact();
    router.push(`/(coach)/scanner?classId=${classId}`);
  }, [classId, router]);

  const openDeck = useCallback(() => {
    router.replace(rollCallDeckPath(classId, { review: true }));
  }, [classId, router]);

  const handleMenuPress = useCallback(() => {
    if (isCompleted) return;

    showDialog({
      title: 'Roll call actions',
      message: 'Review attendance or scan another member.',
      dismissOnBackdropPress: true,
      buttons: [
        {
          label: 'Scan QR',
          variant: 'secondary',
          onPress: () => {
            hideDialog();
            openScanner();
          },
        },
        {
          label: 'Back to roll call',
          variant: 'primary',
          onPress: () => {
            hideDialog();
            openDeck();
          },
        },
      ],
    });
  }, [hideDialog, isCompleted, openDeck, openScanner, showDialog]);

  const handleComplete = useCallback(async () => {
    if (!session?.id) {
      showAlert('No active session', 'Go back to roll call and try again.');
      return;
    }

    try {
      await completeMutation.mutateAsync(session.id);
      triggerSuccessNotification();
      router.replace(rollCallClassHubPath(classId));
    } catch (error) {
      showAlert(
        'Could not submit attendance',
        error instanceof Error ? error.message : 'Check your connection and try again.',
      );
    }
  }, [classId, completeMutation, router, session?.id, showAlert]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBackPress();
        return true;
      });
      return () => subscription.remove();
    }, [handleBackPress]),
  );

  if (rollCallQuery.isLoading) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background.primary, padding: inset.lg }]}>
        <StateBlock kind="loading" title="Loading summary" />
      </View>
    );
  }

  if (rollCallQuery.isError || !summary) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background.primary, padding: inset.lg }]}>
        <StateBlock
          kind="error"
          title="Could not load summary"
          message="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => {
            void rollCallQuery.refetch();
          }}
        />
      </View>
    );
  }

  const isBusy = completeMutation.isPending;
  const footerPaddingBottom = insets.bottom + inset.md;

  return (
    <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
      <AppStatusBar style="dark" translucent backgroundColor="transparent" />

      <RollCallSummaryHeader
        subtitle={subtitle}
        topInset={headerTopInset}
        onBackPress={handleBackPress}
        onMenuPress={handleMenuPress}
        showMenu={!isCompleted}
      />

      <View style={styles.listWrap}>
        <FlashList
          data={attendedMembers}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          renderScrollComponent={FlashListScrollComponent}
          contentContainerStyle={{
            paddingTop: contentTopInset,
            paddingHorizontal: inset.lg,
            paddingBottom: footerPaddingBottom + 168,
          }}
          ItemSeparatorComponent={SummaryRowSeparator}
          ListHeaderComponent={
            <View style={{ gap: gap.lg, paddingBottom: gap.md }}>
              <RollCallSummaryStats summary={summary} />
              <View style={styles.sectionHeader}>
                <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
                  Attended
                </Text>
                <Text style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}>
                  {attendedMembers.length} member{attendedMembers.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <StateBlock
              kind="empty"
              title="No attendees yet"
              message="No members were marked present for this class."
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
        {!isCompleted ? (
          <View style={[styles.footerActions, { gap: gap.sm }]}>
            <Button
              label="Scan QR"
              variant="outline"
              icon="qr-code-outline"
              onPress={openScanner}
              disabled={isBusy}
            />
            <Button
              label="Submit attendance"
              icon="checkmark-circle"
              onPress={() => {
                void handleComplete();
              }}
              loading={isBusy}
              disabled={isBusy}
            />
          </View>
        ) : (
          <Button
            label="Back to class"
            variant="secondary"
            onPress={() => router.replace(`/(coach)/run-class/${classId}`)}
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
  avatar: {
    height: 48,
    width: 48,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
