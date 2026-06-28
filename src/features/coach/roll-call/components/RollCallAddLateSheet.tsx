import React, { memo, useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  RollCallDeckMember,
  RollCallSearchResult,
} from '@/features/coach/roll-call/types';
import { useRollCallMemberSearch } from '@/features/coach/roll-call/hooks/useRollCall';
import { searchResultToDeckMember } from '@/features/coach/roll-call/utils/rollCallSearchUtils';
import { MotiPressable } from '@/shared/animations/MotiPressable';
import { FlashListScrollComponent, TextField } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

type Props = {
  visible: boolean;
  classId: string;
  deckByKey: ReadonlyMap<string, RollCallDeckMember>;
  onClose: () => void;
  onMarkLate: (member: RollCallDeckMember) => Promise<void>;
  onError: (error: unknown) => void;
};

type SearchRowProps = {
  result: RollCallSearchResult;
  existingMarkLabel: string | null;
  onPress: (result: RollCallSearchResult) => void;
};

const SearchRow = memo(function SearchRow({ result, existingMarkLabel, onPress }: SearchRowProps) {
  const { colors, inset, radius, typography, gap } = useTheme();

  const handlePress = useCallback(() => {
    triggerLightImpact();
    onPress(result);
  }, [onPress, result]);

  return (
    <MotiPressable
      onPress={handlePress}
      accessibilityLabel={`Mark ${result.displayName} late`}
      style={[
        styles.row,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
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
      {existingMarkLabel ? (
        <Text style={[typography.textPresets.footnote, { color: colors.status.warning }]}>
          {existingMarkLabel}
        </Text>
      ) : (
        <Text style={[typography.textPresets.footnote, { color: colors.text.tertiary }]}>
          Not on deck · will mark late
        </Text>
      )}
    </MotiPressable>
  );
});

function SearchSeparator() {
  return <View style={styles.separator} />;
}

export const RollCallAddLateSheet = memo(function RollCallAddLateSheet({
  visible,
  classId,
  deckByKey,
  onClose,
  onMarkLate,
  onError,
}: Props) {
  const { colors, inset, radius, typography, gap } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchQuery = useRollCallMemberSearch(classId, query);

  const results = searchQuery.data ?? [];

  const existingMarkLabelFor = useCallback(
    (result: RollCallSearchResult): string | null => {
      const existing = deckByKey.get(result.deckKey);
      if (!existing?.mark) return null;
      if (existing.mark.status === 'late') return 'Already marked late';
      if (existing.mark.status === 'present') return 'Marked present — will change to late';
      if (existing.mark.status === 'absent') return 'Marked absent — will change to late';
      return 'Already marked — will update';
    },
    [deckByKey],
  );

  const handleSelect = useCallback(
    async (result: RollCallSearchResult) => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      try {
        const member = searchResultToDeckMember(result);
        await onMarkLate(member);
        setQuery('');
        onClose();
      } catch (error) {
        onError(error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, onClose, onError, onMarkLate],
  );

  const renderItem = useCallback(
    ({ item }: { item: RollCallSearchResult }) => (
      <SearchRow
        result={item}
        existingMarkLabel={existingMarkLabelFor(item)}
        onPress={handleSelect}
      />
    ),
    [existingMarkLabelFor, handleSelect],
  );

  const keyExtractor = useCallback((item: RollCallSearchResult) => item.deckKey, []);

  const listEmpty = useMemo(() => {
    if (query.trim().length < 2) {
      return (
        <StateBlock
          kind="empty"
          title="Search for a member"
          message="Type at least 2 characters to find someone not on the deck."
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.background.overlay }]}
          onPress={onClose}
          accessibilityLabel="Close add late search"
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
            Add late arrival
          </Text>
          <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
            Search for a member who was not on the roster or needs a late mark.
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
});
