import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { BrandedButton, TextField } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { CommunityAnnouncementCard } from '@/features/communities/components/CommunityAnnouncementCard';
import { useMyCoachRecord } from '@/features/coach/hooks/useMyCoachRecord';
import { useCoachCommunityChannels, usePublishCommunityPost } from '@/features/communities/hooks/useCommunities';
import { useTheme } from '@/shared/theme';
import type { CommunityChannelItem, CommunityPostItem } from '@/types/domain';

type CommunityChannelPickerProps = {
  channels: CommunityChannelItem[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function CommunityChannelPicker({ channels, value, onChange, disabled = false }: CommunityChannelPickerProps) {
  const { colors, typography, gap, radius, layout } = useTheme();

  const handleSelect = useCallback(
    (channelId: string) => {
      if (disabled) return;
      triggerSelectionHaptic();
      onChange(channelId);
    },
    [disabled, onChange],
  );

  return (
    <View style={{ gap: gap.sm }}>
      <Text style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}>Group</Text>
      <View style={[styles.row, { gap: gap.sm }]}>
        {channels.map((channel) => {
          const selected = channel.id === value;
          return (
            <Pressable
              key={channel.id}
              disabled={disabled}
              onPress={() => handleSelect(channel.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.accent.default : colors.background.secondary,
                  borderColor: selected ? colors.accent.default : colors.border.subtle,
                  borderRadius: radius.pill,
                  borderWidth: layout.borderWidth,
                  opacity: disabled ? 0.6 : 1,
                },
              ]}
            >
              <Text
                style={[
                  typography.textPresets.captionMedium,
                  { color: selected ? colors.accent.onAccent : colors.text.secondary },
                ]}
                numberOfLines={1}
              >
                {channel.disciplineName}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export type CommunityAnnouncementComposerProps = {
  initialChannelId?: string;
  lockChannel?: boolean;
  onPublished?: () => void;
};

export function CommunityAnnouncementComposer({
  initialChannelId,
  lockChannel = false,
  onPublished,
}: CommunityAnnouncementComposerProps) {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const router = useRouter();
  const { coach } = useMyCoachRecord();
  const channelsQuery = useCoachCommunityChannels();
  const publishMutation = usePublishCommunityPost(coach?.id ?? '');

  const channels = channelsQuery.data ?? [];
  const [channelId, setChannelId] = useState(initialChannelId ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinOnPublish, setPinOnPublish] = useState(true);

  useEffect(() => {
    if (initialChannelId) {
      setChannelId(initialChannelId);
      return;
    }
    if (!channelId && channels[0]?.id) {
      setChannelId(channels[0].id);
    }
  }, [channelId, channels, initialChannelId]);

  const selectedChannelId = channelId || channels[0]?.id || '';

  const previewPost = useMemo((): CommunityPostItem | null => {
    const trimmedBody = body.trim();
    if (!trimmedBody && !title.trim()) return null;

    return {
      id: 'preview',
      channelId: selectedChannelId,
      authorId: coach?.id ?? '',
      authorName: coach?.name ?? 'Coach',
      authorAvatarUrl: coach?.photoUrl ?? null,
      authorRole: 'coach',
      title: title.trim() || null,
      body: trimmedBody || 'Your announcement preview will appear here.',
      mediaUrl: null,
      postKind: 'announcement',
      isPinned: pinOnPublish,
      pinnedAt: pinOnPublish ? new Date().toISOString() : null,
      publishedAt: new Date().toISOString(),
      reactionCounts: {},
      replyCount: 0,
      myReactions: [],
    };
  }, [body, coach?.id, coach?.name, coach?.photoUrl, pinOnPublish, selectedChannelId, title]);

  const errorMessage =
    publishMutation.error instanceof Error ? publishMutation.error.message : null;

  const handlePublish = useCallback(() => {
    const trimmedBody = body.trim();
    if (!selectedChannelId || !trimmedBody) return;

    publishMutation.mutate(
      {
        channelId: selectedChannelId,
        title: title.trim() || null,
        body: trimmedBody,
        postKind: 'announcement',
        pinOnPublish,
      },
      {
        onSuccess: () => {
          setTitle('');
          setBody('');
          onPublished?.();
        },
      },
    );
  }, [body, onPublished, pinOnPublish, publishMutation, selectedChannelId, title]);

  if (channelsQuery.isLoading) {
    return <StateBlock kind="loading" title="Loading your groups" />;
  }

  if (channelsQuery.isError) {
    return (
      <StateBlock
        kind="error"
        title="Could not load groups"
        message="Check your connection and try again."
        actionLabel="Retry"
        onAction={() => channelsQuery.refetch()}
      />
    );
  }

  if (channels.length === 0) {
    return (
      <StateBlock
        kind="empty"
        title="No groups yet"
        message="Groups are created automatically from your assigned disciplines. Open My groups from the coach menu once academy staff has linked your profile."
        actionLabel="Open My groups"
        onAction={() => router.push('/(coach)/communities')}
      />
    );
  }

  return (
    <View style={[styles.root, { padding: inset.lg, gap: gap.lg }]}>
      <View style={{ gap: gap.xs }}>
        <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
          Post announcement
        </Text>
        <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
          Members in this discipline group receive a notification when you publish.
        </Text>
      </View>

      <CommunityChannelPicker
        channels={channels}
        value={selectedChannelId}
        onChange={setChannelId}
        disabled={lockChannel}
      />

      <TextField label="Title (optional)" value={title} onChangeText={setTitle} />
      <TextField
        label="Announcement"
        value={body}
        onChangeText={setBody}
        multiline
        placeholder="Share schedule updates, technique notes, or event info…"
        style={styles.announcementInput}
      />

      <View
        style={[
          styles.pinRow,
          {
            backgroundColor: colors.surface.secondary,
            borderColor: colors.border.subtle,
            borderRadius: radius.card,
            borderWidth: layout.borderWidth,
            paddingHorizontal: inset.md,
            paddingVertical: inset.sm + 2,
          },
        ]}
      >
        <View style={[styles.pinCopy, { gap: gap.xs }]}>
          <View style={[styles.pinTitleRow, { gap: gap.sm }]}>
            <Ionicons name="pin-outline" size={18} color={colors.accent.default} />
            <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
              Pin to top
            </Text>
          </View>
          <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
            Replaces the current pinned announcement in this group.
          </Text>
        </View>
        <Switch
          value={pinOnPublish}
          onValueChange={(value) => {
            triggerSelectionHaptic();
            setPinOnPublish(value);
          }}
          trackColor={{ false: colors.fill.secondary, true: colors.accent.default }}
          thumbColor={colors.surface.primary}
        />
      </View>

      {previewPost ? (
        <View style={{ gap: gap.sm }}>
          <Text style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}>
            Preview
          </Text>
          <CommunityAnnouncementCard post={previewPost} readOnly />
        </View>
      ) : null}

      {errorMessage ? (
        <Text style={{ color: colors.status.error, fontSize: 13 }}>{errorMessage}</Text>
      ) : null}

      <BrandedButton
        label="Publish announcement"
        onPress={handlePublish}
        loading={publishMutation.isPending}
        disabled={!selectedChannelId || !body.trim()}
      />

      {selectedChannelId ? (
        <Pressable
          onPress={() => router.push(`/communities/${selectedChannelId}`)}
          accessibilityRole="button"
          accessibilityLabel="Open group"
          style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[typography.textPresets.footnote, { color: colors.accent.default, fontWeight: '600' }]}>
            View group after publishing
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pinRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pinCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  pinTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  announcementInput: {
    minHeight: 120,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
});
