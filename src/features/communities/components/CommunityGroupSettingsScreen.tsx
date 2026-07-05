import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppBottomSheet } from '@/shared/components/AppBottomSheet';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import { MemberAvatar } from '@/shared/components/MemberAvatar';
import { StateBlock } from '@/shared/components/StateBlock';
import { AcademyEyebrow } from '@/shared/components/brand';
import { AppBar } from '@/shared/components/ui';
import { CommunityMemberPicker } from '@/features/communities/components/CommunityMemberPicker';
import {
  useAddCommunityGroupMembers,
  useArchiveCommunityGroup,
  useCommunityChannelHeader,
  useCommunityGroupMembers,
  useRemoveCommunityGroupMember,
} from '@/features/communities/hooks/useCommunities';
import { toast } from '@/shared/components/Toast';
import { triggerLightImpact, triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import type {
  CommunityGroupMember,
  CommunityGroupMemberCandidate,
} from '@/types/domain';

function memberSubtitle(member: CommunityGroupMember): string {
  if (member.isCoach) return 'Coach';
  if (member.email) return member.email;
  return 'Active member';
}

type MemberRowProps = {
  member: CommunityGroupMember;
  removing: boolean;
  onRemove: (member: CommunityGroupMember) => void;
};

function MemberRow({ member, removing, onRemove }: MemberRowProps) {
  const { colors, typography, inset, gap, radius, layout } = useTheme();

  return (
    <View
      style={[
        styles.memberRow,
        {
          backgroundColor: colors.surface.secondary,
          borderColor: colors.border.subtle,
          borderRadius: radius.card,
          borderWidth: layout.borderWidth,
          gap: gap.sm,
          padding: inset.sm + 2,
        },
      ]}
    >
      <MemberAvatar
        name={member.fullName}
        avatarUrl={member.avatarUrl}
        size={42}
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
          {memberSubtitle(member)}
        </Text>
      </View>
      {member.isCoach ? (
        <View
          style={[
            styles.ownerBadge,
            {
              backgroundColor: colors.accent.subtle,
              borderRadius: radius.pill,
              paddingHorizontal: inset.sm,
            },
          ]}
        >
          <Ionicons name="shield-checkmark" size={16} color={colors.accent.default} />
          <Text style={[typography.textPresets.captionMedium, { color: colors.accent.default }]}>
            Owner
          </Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${member.fullName}`}
          disabled={removing}
          onPress={() => onRemove(member)}
          hitSlop={10}
          style={({ pressed }) => [{ opacity: removing ? 0.45 : pressed ? 0.72 : 1 }]}
        >
          {removing ? (
            <ActivityIndicator size="small" color={colors.status.error} />
          ) : (
            <Ionicons name="remove-circle-outline" size={24} color={colors.status.error} />
          )}
        </Pressable>
      )}
    </View>
  );
}

export function CommunityGroupSettingsScreen() {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const channelId = typeof id === 'string' ? id : '';
  const [selectedMembers, setSelectedMembers] = useState<CommunityGroupMemberCandidate[]>([]);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const headerQuery = useCommunityChannelHeader(channelId, Boolean(channelId));
  const channel = headerQuery.data;
  const isGroup = channel?.channelKind === 'group';
  const membersQuery = useCommunityGroupMembers(
    channelId,
    channel?.coachId ?? '',
    Boolean(channelId && channel?.coachId && isGroup),
  );
  const addMutation = useAddCommunityGroupMembers(channelId, channel?.coachId ?? '');
  const removeMutation = useRemoveCommunityGroupMember(channelId, channel?.coachId ?? '');
  const archiveMutation = useArchiveCommunityGroup(channel?.coachId ?? '');
  const members = membersQuery.data ?? [];
  const memberCount = useMemo(
    () => members.filter((member) => !member.isCoach).length,
    [members],
  );

  const handleAdd = () => {
    if (!channel || selectedMembers.length === 0 || addMutation.isPending) return;

    triggerLightImpact();
    addMutation.mutate(selectedMembers, {
      onSuccess: () => {
        toast.success('Members added');
        setSelectedMembers([]);
      },
      onError: () => {
        toast.error('Could not add members', 'Please try again.');
      },
    });
  };

  const handleRemoveMember = (member: CommunityGroupMember) => {
    if (member.isCoach || removeMutation.isPending) return;

    Alert.alert('Remove member?', `${member.fullName} will lose access to this group.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeMutation.mutate(member.id, {
            onSuccess: () => toast.success('Member removed'),
            onError: () => toast.error('Could not remove member', 'Please try again.'),
          });
        },
      },
    ]);
  };

  const handleArchive = () => {
    if (!channel || archiveMutation.isPending) return;

    triggerLightImpact();
    archiveMutation.mutate(channel.id, {
      onSuccess: () => {
        toast.success('Group removed');
        setConfirmRemoveOpen(false);
        router.replace('/(coach)/communities');
      },
      onError: () => {
        toast.error('Could not remove group', 'Please try again.');
      },
    });
  };

  const renderContent = () => {
    if (headerQuery.isLoading) {
      return <StateBlock kind="loading" title="Loading group settings" />;
    }

    if (headerQuery.isError || !channel) {
      return (
        <StateBlock
          kind="error"
          title="Could not load group"
          message="Please check your connection and try again."
          actionLabel="Retry"
          onAction={() => headerQuery.refetch()}
        />
      );
    }

    if (!isGroup) {
      return (
        <StateBlock
          kind="empty"
          title="Community announcements"
          message="Announcement communities do not have manual group settings."
        />
      );
    }

    return (
      <>
        <View style={{ gap: gap.md }}>
          <View
            style={[
              styles.summary,
              {
                backgroundColor: colors.surface.secondary,
                borderColor: colors.border.subtle,
                borderRadius: radius.card,
                borderWidth: layout.borderWidth,
                padding: inset.md,
              },
            ]}
          >
            <View style={styles.summaryTop}>
              <View style={styles.summaryCopy}>
                <AcademyEyebrow label="Group settings" accent />
                <Text
                  numberOfLines={2}
                  style={[typography.textPresets.subtitle, { color: colors.text.primary }]}
                >
                  {channel.title}
                </Text>
                <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
                  {channel.disciplineName} · Private
                </Text>
              </View>
              <View
                style={[
                  styles.countPill,
                  {
                    backgroundColor: colors.accent.subtle,
                    borderRadius: radius.pill,
                    paddingHorizontal: inset.sm,
                  },
                ]}
              >
                <Text style={[styles.countText, { color: colors.accent.default }]}>
                  {memberCount}
                </Text>
              </View>
            </View>
            {channel.description ? (
              <Text style={[typography.textPresets.bodyMedium, { color: colors.text.secondary }]}>
                {channel.description}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ gap: gap.md }}>
          <Text style={[typography.textPresets.metricLabel, { color: colors.text.tertiary }]}>
            ADD MEMBERS
          </Text>
          <CommunityMemberPicker
            coachId={channel.coachId}
            channelId={channel.id}
            selectedMembers={selectedMembers}
            onSelectedMembersChange={setSelectedMembers}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add selected members"
            accessibilityState={{ disabled: selectedMembers.length === 0 || addMutation.isPending }}
            disabled={selectedMembers.length === 0 || addMutation.isPending}
            onPress={handleAdd}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.accent.default,
                borderRadius: radius.pill,
                opacity:
                  selectedMembers.length === 0 || addMutation.isPending
                    ? 0.45
                    : pressed
                      ? 0.88
                      : 1,
              },
            ]}
          >
            {addMutation.isPending ? (
              <ActivityIndicator color={colors.accent.onAccent} />
            ) : (
              <Text style={[typography.textPresets.button, { color: colors.accent.onAccent }]}>
                Add {selectedMembers.length > 0 ? selectedMembers.length : ''} members
              </Text>
            )}
          </Pressable>
        </View>

        <View style={{ gap: gap.md }}>
          <Text style={[typography.textPresets.metricLabel, { color: colors.text.tertiary }]}>
            MEMBERS · {memberCount}
          </Text>
          {membersQuery.isLoading ? (
            <StateBlock kind="loading" title="Loading members" />
          ) : membersQuery.isError ? (
            <StateBlock
              kind="error"
              title="Could not load members"
              actionLabel="Retry"
              onAction={() => membersQuery.refetch()}
            />
          ) : members.length === 0 ? (
            <StateBlock kind="empty" title="No members yet" />
          ) : (
            <View style={{ gap: gap.xs }}>
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  removing={removeMutation.isPending}
                  onRemove={handleRemoveMember}
                />
              ))}
            </View>
          )}
        </View>

        <View style={{ gap: gap.sm }}>
          <Text style={[typography.textPresets.metricLabel, { color: colors.text.tertiary }]}>
            DANGER ZONE
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove group"
            onPress={() => {
              triggerSelectionHaptic();
              setConfirmRemoveOpen(true);
            }}
            style={({ pressed }) => [
              styles.removeButton,
              {
                borderColor: colors.status.errorBorder,
                borderRadius: radius.pill,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.status.error} />
            <Text style={[typography.textPresets.button, { color: colors.status.error }]}>
              Remove group
            </Text>
          </Pressable>
        </View>
      </>
    );
  };

  return (
    <AppSafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar
        title="Group settings"
        showBackButton
        fallbackHref="/(coach)/communities"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            gap: gap.xl,
            paddingHorizontal: inset.lg,
            paddingTop: inset.lg,
            paddingBottom: inset.xl,
          }}
        >
          {renderContent()}
        </ScrollView>
      </KeyboardAvoidingView>

      <AppBottomSheet
        visible={confirmRemoveOpen}
        onDismiss={() => setConfirmRemoveOpen(false)}
        dismissOnBackdropPress={!archiveMutation.isPending}
      >
        <View style={{ gap: gap.sm }}>
          <Text style={[typography.textPresets.subtitle, { color: colors.text.primary }]}>
            Remove group?
          </Text>
          <Text style={[typography.textPresets.bodyMedium, { color: colors.text.secondary }]}>
            Members will lose access to this group and its chat. This cannot be undone from the app.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirm remove group"
          disabled={archiveMutation.isPending}
          onPress={handleArchive}
          style={({ pressed }) => [
            styles.confirmRemoveButton,
            {
              backgroundColor: colors.status.error,
              borderRadius: radius.pill,
              opacity: archiveMutation.isPending ? 0.6 : pressed ? 0.88 : 1,
            },
          ]}
        >
          {archiveMutation.isPending ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Text style={[typography.textPresets.button, { color: colors.text.inverse }]}>
              Remove group
            </Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          disabled={archiveMutation.isPending}
          onPress={() => setConfirmRemoveOpen(false)}
          style={styles.cancelButton}
        >
          <Text style={[typography.textPresets.button, { color: colors.text.secondary }]}>
            Cancel
          </Text>
        </Pressable>
      </AppBottomSheet>
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  summary: {
    gap: 12,
  },
  summaryTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  countPill: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 46,
  },
  countText: {
    fontSize: 14,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 20,
  },
  memberRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  memberCopy: {
    flex: 1,
    minWidth: 0,
  },
  ownerBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    minHeight: 30,
  },
  removeButton: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 18,
  },
  confirmRemoveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
});
