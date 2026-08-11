import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RollCallEmptyState } from '@/features/coach/roll-call/components/RollCallEmptyState';
import { RollCallMemberRow } from '@/features/coach/roll-call/components/RollCallMemberRow';
import { RollCallProgress } from '@/features/coach/roll-call/components/RollCallProgress';
import type { RollCallDeckMember } from '@/features/coach/roll-call/types';
import { countUnmarkedDeckMembers } from '@/features/coach/roll-call/utils/rollCallSession';
import { formatRunClassSchedule } from '@/features/coach/utils/classDisplay';
import { AppStatusBar } from '@/shared/components/AppStatusBar';
import { useDialog } from '@/shared/components/Dialog/useDialog';
import { StateBlock } from '@/shared/components/StateBlock';
import { AppBar, Button, FlashListScrollComponent } from '@/shared/components/ui';
import {
  FLASH_LIST_ESTIMATES,
  flashListOverrideItemLayout,
} from '@/shared/constants/flashListEstimates';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { FlashList } from '@shopify/flash-list';

type Props = {
  classId: string;
  classTitle: string;
  startsAt: string;
  members: RollCallDeckMember[];
  isLoading?: boolean;
  isRecording?: boolean;
  onBackPress: () => void;
  onScanPress: () => void;
  onMarkPresent: (member: RollCallDeckMember) => void;
  onMarkAbsent: (member: RollCallDeckMember) => void;
  onRemoveMember: (member: RollCallDeckMember) => void;
  onOpenSummary: () => void;
};

type RowProps = {
  member: RollCallDeckMember;
  disabled: boolean;
  onMarkPresent: (member: RollCallDeckMember) => void;
  onMarkAbsent: (member: RollCallDeckMember) => void;
  onDelete: (member: RollCallDeckMember) => void;
};

const ListRow = memo(function ListRow({
  member,
  disabled,
  onMarkPresent,
  onMarkAbsent,
  onDelete,
}: RowProps) {
  return (
    <RollCallMemberRow
      member={member}
      disabled={disabled}
      onMarkPresent={onMarkPresent}
      onMarkAbsent={onMarkAbsent}
      onDelete={onDelete}
    />
  );
});

function ListRowSeparator() {
  const { gap } = useTheme();
  return <View style={{ height: gap.sm }} />;
}

export const RollCallListScreen = memo(function RollCallListScreen({
  classTitle,
  startsAt,
  members,
  isLoading = false,
  isRecording = false,
  onBackPress,
  onScanPress,
  onMarkPresent,
  onMarkAbsent,
  onRemoveMember,
  onOpenSummary,
}: Props) {
  const insets = useSafeAreaInsets();
  const { showConfirm } = useDialog();
  const { colors, typography, inset, gap } = useTheme();

  const scheduleLabel = useMemo(() => formatRunClassSchedule(startsAt), [startsAt]);
  const markedCount = useMemo(
    () => members.filter((member) => member.mark !== null).length,
    [members],
  );
  const unmarkedCount = useMemo(() => countUnmarkedDeckMembers(members), [members]);
  const showReviewSummary = unmarkedCount === 0 && members.length > 0;
  const footerPaddingBottom = insets.bottom + inset.md;
  const listBottomPadding = footerPaddingBottom + (showReviewSummary ? 168 : 112);

  const handleDelete = useCallback(
    (member: RollCallDeckMember) => {
      showConfirm(
        'Remove from list?',
        `${member.displayName} will be removed from this class list. You can scan their QR again to re-add them.`,
        () => {
          onRemoveMember(member);
        },
        {
          confirmLabel: 'Remove',
          destructive: true,
        },
      );
    },
    [onRemoveMember, showConfirm],
  );

  const handleScanPress = useCallback(() => {
    triggerLightImpact();
    onScanPress();
  }, [onScanPress]);

  const renderItem = useCallback(
    ({ item }: { item: RollCallDeckMember }) => (
      <ListRow
        member={item}
        disabled={isRecording}
        onMarkPresent={onMarkPresent}
        onMarkAbsent={onMarkAbsent}
        onDelete={handleDelete}
      />
    ),
    [handleDelete, isRecording, onMarkAbsent, onMarkPresent],
  );

  const keyExtractor = useCallback((item: RollCallDeckMember) => item.deckKey, []);

  const listHeader = useMemo(
    () => (
      <View style={{ gap: gap.md, paddingBottom: gap.sm }}>
        <Text
          style={[
            typography.textPresets.footnote,
            styles.schedule,
            { color: colors.text.secondary },
          ]}
          numberOfLines={1}
        >
          {scheduleLabel}
        </Text>
        {members.length > 0 ? <RollCallProgress completed={markedCount} total={members.length} /> : null}
      </View>
    ),
    [colors.text.secondary, gap.md, gap.sm, markedCount, members.length, scheduleLabel, typography],
  );

  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background.primary }]}>
        <AppStatusBar style="dark" translucent backgroundColor="transparent" />
        <AppBar title={classTitle} showBackButton onBackPress={onBackPress} />
        <StateBlock kind="loading" title="Loading class list" message="Just a moment…" />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background.primary }]}>
      <AppStatusBar style="dark" translucent backgroundColor="transparent" />
      <AppBar title={classTitle} showBackButton onBackPress={onBackPress} />

      {members.length === 0 ? (
        <RollCallEmptyState onScanPress={handleScanPress} />
      ) : (
        <>
          <View style={styles.listWrap}>
            <FlashList
              data={members}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              overrideItemLayout={flashListOverrideItemLayout(
                FLASH_LIST_ESTIMATES.rollCallMemberRow,
              )}
              renderScrollComponent={FlashListScrollComponent}
              contentContainerStyle={{
                paddingHorizontal: inset.lg,
                paddingTop: inset.sm,
                paddingBottom: listBottomPadding,
              }}
              ItemSeparatorComponent={ListRowSeparator}
              ListHeaderComponent={listHeader}
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
            <Button
              label="Scan QR"
              icon="qr-code-outline"
              onPress={handleScanPress}
              disabled={isRecording}
            />
            {showReviewSummary ? (
              <Button
                label="Review summary"
                variant="secondary"
                icon="list-outline"
                onPress={() => {
                  triggerLightImpact();
                  onOpenSummary();
                }}
                disabled={isRecording}
              />
            ) : null}
          </View>
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listWrap: {
    flex: 1,
  },
  schedule: {
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
