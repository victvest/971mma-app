import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MemberAvatar } from '@/shared/components/MemberAvatar';
import { StateBlock } from '@/shared/components/StateBlock';
import { TextField } from '@/shared/components/ui';
import {
  useCommunityGroupMemberCandidates,
  useCommunityMemberCandidates,
} from '@/features/communities/hooks/useCommunities';
import { useTheme } from '@/shared/theme';
import type { CommunityGroupMemberCandidate } from '@/types/domain';

type CommunityMemberPickerProps = {
  coachId: string;
  channelId?: string;
  selectedMembers: CommunityGroupMemberCandidate[];
  onSelectedMembersChange: (members: CommunityGroupMemberCandidate[]) => void;
};

export function CommunityMemberPicker({
  coachId,
  channelId,
  selectedMembers,
  onSelectedMembersChange,
}: CommunityMemberPickerProps) {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const [query, setQuery] = useState('');
  const selectedIds = useMemo(
    () => new Set(selectedMembers.map((member) => member.id)),
    [selectedMembers],
  );
  const trimmed = query.trim();
  const canSearch = trimmed.length >= 2;
  const globalQuery = useCommunityMemberCandidates(coachId, query, !channelId && canSearch);
  const groupQuery = useCommunityGroupMemberCandidates(
    channelId ?? '',
    coachId,
    query,
    Boolean(channelId) && canSearch,
  );
  const candidatesQuery = channelId ? groupQuery : globalQuery;
  const candidates = candidatesQuery.data ?? [];

  const toggleMember = (member: CommunityGroupMemberCandidate) => {
    if (selectedIds.has(member.id)) {
      onSelectedMembersChange(selectedMembers.filter((item) => item.id !== member.id));
      return;
    }
    onSelectedMembersChange([...selectedMembers, member]);
  };

  const clearMember = (memberId: string) => {
    onSelectedMembersChange(selectedMembers.filter((item) => item.id !== memberId));
  };

  return (
    <View style={{ gap: gap.md }}>
      <TextField
        label="Search members"
        value={query}
        onChangeText={setQuery}
        placeholder="Name, email, or Mindbody ID"
        autoCapitalize="none"
        autoCorrect={false}
        containerStyle={styles.field}
      />

      {selectedMembers.length > 0 ? (
        <View style={[styles.selectedWrap, { gap: gap.xs }]}>
          {selectedMembers.map((member) => (
            <Pressable
              key={member.id}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${member.fullName}`}
              onPress={() => clearMember(member.id)}
              style={({ pressed }) => [
                styles.selectedChip,
                {
                  backgroundColor: colors.accent.subtle,
                  borderRadius: radius.pill,
                  opacity: pressed ? 0.82 : 1,
                  paddingHorizontal: inset.sm,
                },
              ]}
            >
              <Text style={[styles.selectedText, { color: colors.accent.default }]}>
                {member.fullName}
              </Text>
              <Ionicons name="close" size={14} color={colors.accent.default} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {!canSearch ? (
        <View
          style={[
            styles.searchHint,
            {
              backgroundColor: colors.fill.secondary,
              borderColor: colors.border.subtle,
              borderRadius: radius.card,
              borderWidth: layout.borderWidth,
              paddingHorizontal: inset.md,
              paddingVertical: inset.sm,
            },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.text.tertiary} />
          <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
            Search at least 2 characters to find active academy members.
          </Text>
        </View>
      ) : candidatesQuery.isLoading || candidatesQuery.isFetching ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent.default} />
        </View>
      ) : candidatesQuery.isError ? (
        <StateBlock
          kind="error"
          title="Could not search members"
          actionLabel="Retry"
          onAction={() => candidatesQuery.refetch()}
        />
      ) : candidates.length === 0 && trimmed.length >= 2 ? (
        <StateBlock
          kind="empty"
          title="No valid members found"
          message="Try a different search."
        />
      ) : (
        <View style={{ gap: gap.xs }}>
          {candidates.slice(0, 8).map((member) => {
            const selected = selectedIds.has(member.id);
            return (
              <Pressable
                key={member.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => toggleMember(member)}
                style={({ pressed }) => [
                  styles.memberRow,
                  {
                    backgroundColor: selected ? colors.accent.subtle : colors.surface.secondary,
                    borderColor: selected ? colors.accent.default : colors.border.subtle,
                    borderRadius: radius.card,
                    borderWidth: selected ? 1.5 : layout.borderWidth,
                    opacity: pressed ? 0.86 : 1,
                    padding: inset.sm + 2,
                  },
                ]}
              >
                <MemberAvatar
                  name={member.fullName}
                  avatarUrl={member.avatarUrl}
                  size={38}
                  backgroundColor={colors.accent.default}
                  textColor={colors.text.inverse}
                />
                <View style={styles.memberCopy}>
                  <Text
                    numberOfLines={1}
                    style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}
                  >
                    {member.fullName}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[typography.textPresets.caption, { color: colors.text.secondary }]}
                  >
                    {member.email ?? 'Active member'}
                  </Text>
                </View>
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'add-circle-outline'}
                  size={22}
                  color={selected ? colors.accent.default : colors.text.tertiary}
                />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 0,
  },
  selectedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  selectedChip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: 32,
  },
  selectedText: {
    fontSize: 12,
    fontWeight: '800',
  },
  loadingRow: {
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  searchHint: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  memberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  memberCopy: {
    flex: 1,
    minWidth: 0,
  },
});
