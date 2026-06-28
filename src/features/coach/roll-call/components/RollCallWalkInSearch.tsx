import React, { memo, useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RollCallDeckMember, RollCallSearchResult } from '@/features/coach/roll-call/types';
import { useRollCallMemberSearch } from '@/features/coach/roll-call/hooks/useRollCall';
import { searchResultToWalkInMember } from '@/features/coach/roll-call/utils/rollCallSearchUtils';
import { MotiPressable } from '@/shared/animations/MotiPressable';
import { FlashListScrollComponent, TextField } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { triggerLightImpact, triggerSuccessNotification } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

type Props = {
  visible: boolean;
  classId: string;
  onClose: () => void;
  onAddWalkIn: (member: RollCallDeckMember) => void;
  onError: (error: unknown) => void;
};

type SearchRowProps = {
  result: RollCallSearchResult;
  isSelected: boolean;
  onPress: (result: RollCallSearchResult) => void;
};

const SearchRow = memo(function SearchRow({ result, isSelected, onPress }: SearchRowProps) {
  const { colors, inset, radius, typography, gap } = useTheme();

  const handlePress = useCallback(() => {
    triggerLightImpact();
    onPress(result);
  }, [onPress, result]);

  return (
    <MotiPressable
      onPress={handlePress}
      accessibilityLabel={`Select walk-in ${result.displayName}`}
      style={[
        styles.row,
        {
          backgroundColor: isSelected ? colors.accent.subtle : colors.surface.primary,
          borderColor: isSelected ? colors.accent.default : colors.border.subtle,
          borderRadius: radius.card,
          padding: inset.md,
          gap: gap.xs,
        },
      ]}
    >
      <Text
        style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}
        numberOfLines={1}
      >
        {result.displayName}
      </Text>
      <Text style={[typography.textPresets.footnote, { color: colors.text.tertiary }]}>
        {result.isOnApp ? 'On app' : 'Not on app'}
        {result.alreadyOnDeck ? ' · already on deck' : ' · walk-in'}
      </Text>
    </MotiPressable>
  );
});

function SearchSeparator() {
  return <View style={styles.separator} />;
}

const ConfirmPanel = memo(function ConfirmPanel({
  result,
  confirmed,
  onToggleConfirm,
  onAdd,
  onCancel,
}: {
  result: RollCallSearchResult;
  confirmed: boolean;
  onToggleConfirm: () => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  const { colors, inset, radius, typography, gap } = useTheme();
  const requiresGuestAck = !result.isOnApp || !result.userId;

  const handleAdd = useCallback(() => {
    triggerSuccessNotification();
    onAdd();
  }, [onAdd]);

  return (
    <View
      style={[
        styles.confirmPanel,
        {
          backgroundColor: colors.status.warningSubtle,
          borderColor: colors.status.warningBorder,
          borderRadius: radius.card,
          padding: inset.md,
          gap: gap.sm,
        },
      ]}
    >
      <Text style={[typography.textPresets.bodyStrong, { color: colors.status.warning }]}>
        Walk-in — not on class roster
      </Text>
      <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
        {result.displayName} will appear as the next card. Swipe right to mark present.
      </Text>
      {requiresGuestAck ? (
        <Text style={[typography.textPresets.footnote, { color: colors.status.warning }]}>
          Guest / not on app — coach confirmation required.
        </Text>
      ) : null}

      <Pressable
        onPress={onToggleConfirm}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
        accessibilityLabel="I confirm this attendee is present in the gym"
        style={[styles.checkboxRow, { gap: gap.sm }]}
      >
        <Ionicons
          name={confirmed ? 'checkbox' : 'square-outline'}
          size={22}
          color={confirmed ? colors.accent.default : colors.text.secondary}
        />
        <Text style={[typography.textPresets.body, { color: colors.text.primary, flex: 1 }]}>
          I confirm this attendee is present in the gym
        </Text>
      </Pressable>

      <View style={[styles.confirmActions, { gap: gap.sm }]}>
        <MotiPressable
          onPress={onCancel}
          accessibilityLabel="Cancel walk-in"
          style={[
            styles.confirmButton,
            {
              minHeight: 48,
              borderRadius: radius.button,
              backgroundColor: colors.surface.primary,
              borderColor: colors.border.default,
            },
          ]}
        >
          <Text style={[typography.textPresets.buttonSmall, { color: colors.text.primary }]}>
            Cancel
          </Text>
        </MotiPressable>
        <MotiPressable
          onPress={handleAdd}
          disabled={!confirmed}
          accessibilityLabel="Add walk-in to deck"
          style={[
            styles.confirmButton,
            {
              minHeight: 48,
              borderRadius: radius.button,
              backgroundColor: colors.accent.default,
              borderColor: colors.accent.default,
              opacity: confirmed ? 1 : 0.45,
            },
          ]}
        >
          <Text style={[typography.textPresets.buttonSmall, { color: colors.accent.onAccent }]}>
            Add to deck
          </Text>
        </MotiPressable>
      </View>
    </View>
  );
});

export const RollCallWalkInSearch = memo(function RollCallWalkInSearch({
  visible,
  classId,
  onClose,
  onAddWalkIn,
  onError,
}: Props) {
  const { colors, inset, radius, typography, gap } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [pendingResult, setPendingResult] = useState<RollCallSearchResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const searchQuery = useRollCallMemberSearch(classId, query);

  const results = searchQuery.data ?? [];

  const handleClose = useCallback(() => {
    setPendingResult(null);
    setConfirmed(false);
    setQuery('');
    onClose();
  }, [onClose]);

  const handleSelect = useCallback((result: RollCallSearchResult) => {
    setPendingResult(result);
    setConfirmed(false);
  }, []);

  const handleToggleConfirm = useCallback(() => {
    setConfirmed((value) => !value);
  }, []);

  const handleCancelConfirm = useCallback(() => {
    setPendingResult(null);
    setConfirmed(false);
  }, []);

  const handleAddToDeck = useCallback(() => {
    if (!pendingResult || !confirmed) return;

    try {
      if (pendingResult.alreadyOnDeck) {
        const member = searchResultToWalkInMember(pendingResult);
        onAddWalkIn(member);
      } else {
        onAddWalkIn(searchResultToWalkInMember(pendingResult));
      }
      handleClose();
    } catch (error) {
      onError(error);
    }
  }, [confirmed, handleClose, onAddWalkIn, onError, pendingResult]);

  const renderItem = useCallback(
    ({ item }: { item: RollCallSearchResult }) => (
      <SearchRow
        result={item}
        isSelected={pendingResult?.deckKey === item.deckKey}
        onPress={handleSelect}
      />
    ),
    [handleSelect, pendingResult?.deckKey],
  );

  const keyExtractor = useCallback((item: RollCallSearchResult) => item.deckKey, []);

  const listEmpty = useMemo(() => {
    if (query.trim().length < 2) {
      return (
        <StateBlock
          kind="empty"
          title="Search for a walk-in"
          message="Type at least 2 characters. Walk-ins are added to the top of the deck."
        />
      );
    }
    if (searchQuery.isLoading) {
      return <StateBlock kind="loading" title="Searching members" />;
    }
    return (
      <StateBlock kind="empty" title="No matches" message="Try another name or email." />
    );
  }, [query, searchQuery.isLoading]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.background.overlay }]}
          onPress={handleClose}
          accessibilityLabel="Close walk-in search"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background.primary,
              borderTopLeftRadius: radius.modal,
              borderTopRightRadius: radius.modal,
              paddingTop: inset.lg,
              paddingBottom: insets.bottom + inset.lg,
              paddingHorizontal: inset.lg,
              gap: gap.md,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border.default }]} />
          <Text style={[typography.textPresets.coachSectionTitle, { color: colors.text.primary }]}>
            Add walk-in
          </Text>
          <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
            Unbooked attendees are inserted as the next card. Mark them present with a right swipe.
          </Text>

          <TextField
            label="Search"
            value={query}
            onChangeText={setQuery}
            placeholder="Name or email"
            autoCapitalize="none"
            autoCorrect={false}
            icon="search-outline"
          />

          {pendingResult ? (
            <ConfirmPanel
              result={pendingResult}
              confirmed={confirmed}
              onToggleConfirm={handleToggleConfirm}
              onAdd={handleAddToDeck}
              onCancel={handleCancelConfirm}
            />
          ) : null}

          <View style={[styles.listWrap, { borderRadius: radius.card }]}>
            <FlashList
              data={results}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              ItemSeparatorComponent={SearchSeparator}
              renderScrollComponent={FlashListScrollComponent}
              ListEmptyComponent={listEmpty}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '78%',
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 4,
    width: 40,
  },
  listWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  row: {
    borderWidth: 1,
  },
  separator: {
    height: 8,
  },
  confirmPanel: {
    borderWidth: 1,
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  confirmActions: {
    flexDirection: 'row',
  },
  confirmButton: {
    alignItems: 'center',
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
});
