import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { MotiPressable } from '@/shared/animations/MotiPressable';
import { useCoachMemberSearch } from '@/features/belt/hooks/useBeltPath';
import { StateBlock } from '@/shared/components/StateBlock';
import { FlashListScrollComponent, TextField } from '@/shared/components/ui';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import type { CoachMemberSearchItem } from '@/types/domain';

type CoachMemberSearchListProps = {
  onSelectMember: (member: CoachMemberSearchItem) => void;
};

export function CoachMemberSearchList({ onSelectMember }: CoachMemberSearchListProps) {
  const { colors, typography, inset, gap, radius } = useTheme();
  const [query, setQuery] = useState('');
  const searchQuery = useCoachMemberSearch(query);
  const results = searchQuery.data ?? [];
  const trimmed = query.trim();
  const canSearch = trimmed.length >= 2;
  const showResults = canSearch && searchQuery.isSuccess;

  const handlePress = useCallback(
    (member: CoachMemberSearchItem) => {
      triggerLightImpact();
      onSelectMember(member);
    },
    [onSelectMember],
  );

  const renderItem = useCallback(
    ({ item }: { item: CoachMemberSearchItem }) => (
      <MotiPressable
        onPress={() => handlePress(item)}
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
        <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
          {item.fullName}
        </Text>
        <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
          {item.email}
        </Text>
        <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>
          {item.beltRank ?? 'Unranked'} · Stripe {item.beltStripes}
        </Text>
      </MotiPressable>
    ),
    [colors, gap, handlePress, inset, radius, typography],
  );

  return (
    <View style={{ gap: gap.md }}>
      <TextField
        label="Search members"
        value={query}
        onChangeText={setQuery}
        placeholder="Name or email"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {trimmed.length < 2 ? (
        <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
          Type at least 2 characters to search your academy members.
        </Text>
      ) : searchQuery.isLoading || (searchQuery.isFetching && !searchQuery.isFetched) ? (
        <StateBlock kind="loading" title="Searching members" />
      ) : searchQuery.isError ? (
        <StateBlock
          kind="error"
          title="Search failed"
          message={
            searchQuery.error instanceof Error
              ? searchQuery.error.message
              : 'Please try again.'
          }
          actionLabel="Retry"
          onAction={() => searchQuery.refetch()}
        />
      ) : showResults && results.length === 0 ? (
        <StateBlock
          kind="empty"
          title="No members found"
          message="Try a different name, email, or Mindbody client ID."
        />
      ) : showResults ? (
        <FlashList
          renderScrollComponent={FlashListScrollComponent}
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          estimatedItemSize={88}
          scrollEnabled={false}
          contentContainerStyle={{ gap: gap.sm }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
