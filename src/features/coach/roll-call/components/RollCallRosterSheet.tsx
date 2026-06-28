import React, { memo, useCallback, useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RollCallMarkStatusChip } from '@/features/coach/roll-call/components/RollCallMarkStatusChip';
import type { RollCallDeckMember } from '@/features/coach/roll-call/types';
import { rollCallStatusDisplayLabel } from '@/features/coach/roll-call/types';
import { FlashListScrollComponent } from '@/shared/components/ui';
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
  const statusLabel = member.mark
    ? rollCallStatusDisplayLabel(member.mark.status)
    : 'Not marked';

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
  const insets = useSafeAreaInsets();
  const { colors, typography, inset, gap, radius } = useTheme();

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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close roster" />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background.primary,
            borderTopLeftRadius: radius.modal,
            borderTopRightRadius: radius.modal,
            paddingBottom: insets.bottom + inset.md,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border.default }]} />
        <View style={[styles.header, { paddingHorizontal: inset.lg, paddingBottom: inset.sm }]}>
          <View style={styles.headerText}>
            <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
              Class roster
            </Text>
            <Text style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}>
              {markedCount} of {members.length} marked
            </Text>
          </View>
          <Pressable
            onPress={() => {
              triggerLightImpact();
              onClose();
            }}
            accessibilityLabel="Close roster"
            hitSlop={12}
          >
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </Pressable>
        </View>

        <View style={[styles.listWrap, { paddingHorizontal: inset.lg }]}>
          <FlashList
            data={sortedMembers}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            renderScrollComponent={FlashListScrollComponent}
            ItemSeparatorComponent={RosterRowSeparator}
          />
        </View>
      </View>
    </Modal>
  );
});

function RosterRowSeparator() {
  const { gap } = useTheme();
  return <View style={{ height: gap.sm }} />;
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    bottom: 0,
    left: 0,
    maxHeight: '82%',
    position: 'absolute',
    right: 0,
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 4,
    marginTop: 8,
    width: 36,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
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
