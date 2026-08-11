import React, { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { RollCallMarkStatusChip } from '@/features/coach/roll-call/components/RollCallMarkStatusChip';
import type { RollCallDeckMember } from '@/features/coach/roll-call/types';
import { rollCallStatusDisplayLabel } from '@/features/coach/roll-call/types';
import { AppBottomSheet } from '@/shared/components/AppBottomSheet';
import { FlashListScrollComponent } from '@/shared/components/ui';
import {
  FLASH_LIST_ESTIMATES,
  flashListOverrideItemLayout,
} from '@/shared/constants/flashListEstimates';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

type Props = {
  visible: boolean;
  members: RollCallDeckMember[];
  onClose: () => void;
};

type RowProps = {
  member: RollCallDeckMember;
};

const RollCallRosterRow = memo(function RollCallRosterRow({ member }: RowProps) {
  const { colors, typography, inset, gap, radius } = useTheme();
  const statusLabel = member.mark ? rollCallStatusDisplayLabel(member.mark.status) : 'Not marked';

  return (
    <View
      style={[
        styles.row,
        {
          borderRadius: radius.card,
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          padding: inset.md,
          gap: gap.xs,
        },
      ]}
    >
      <View style={styles.rowMain}>
        <Text
          style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}
          numberOfLines={1}
        >
          {member.displayName}
        </Text>
        <Text
          style={[
            typography.textPresets.captionMedium,
            {
              color: member.mark ? colors.text.secondary : colors.text.tertiary,
            },
          ]}
          numberOfLines={1}
        >
          {statusLabel}
        </Text>
      </View>
      {member.mark ? <RollCallMarkStatusChip mark={member.mark} /> : null}
    </View>
  );
});

export const RollCallRosterSheet = memo(function RollCallRosterSheet({
  visible,
  members,
  onClose,
}: Props) {
  const { colors, typography, gap } = useTheme();

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const aMarked = a.mark ? 1 : 0;
        const bMarked = b.mark ? 1 : 0;
        if (aMarked !== bMarked) return aMarked - bMarked;
        return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
      }),
    [members],
  );

  const markedCount = useMemo(
    () => members.filter((member) => member.mark !== null).length,
    [members],
  );

  const renderItem = useCallback(
    ({ item }: { item: RollCallDeckMember }) => <RollCallRosterRow member={item} />,
    [],
  );

  const keyExtractor = useCallback((item: RollCallDeckMember) => item.deckKey, []);

  const handleClose = useCallback(() => {
    triggerLightImpact();
    onClose();
  }, [onClose]);

  return (
    <AppBottomSheet
      visible={visible}
      onDismiss={onClose}
      contentStyle={[styles.sheet, { backgroundColor: colors.background.primary, gap: gap.md }]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
            Class roster
          </Text>
          <Text style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}>
            {markedCount} of {members.length} marked
          </Text>
        </View>
        <Pressable onPress={handleClose} accessibilityLabel="Close roster" hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </Pressable>
      </View>

      <View style={styles.listWrap}>
        <FlashList
          data={sortedMembers}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          overrideItemLayout={flashListOverrideItemLayout(FLASH_LIST_ESTIMATES.rollCallRosterRow)}
          renderScrollComponent={FlashListScrollComponent}
          ItemSeparatorComponent={RosterRowSeparator}
        />
      </View>
    </AppBottomSheet>
  );
});

function RosterRowSeparator() {
  const { gap } = useTheme();
  return <View style={{ height: gap.sm }} />;
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '82%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  listWrap: {
    flex: 1,
    minHeight: 240,
  },
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
});
