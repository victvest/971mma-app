import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TabHeroTitle } from '@/shared/components/brand';
import { AppBottomSheetButton } from '@/shared/components/AppBottomSheet';
import { Chip, TextField } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { CommunityAnnouncementCard } from '@/features/communities/components/CommunityAnnouncementCard';
import { useMyCoachRecord } from '@/features/coach/hooks/useMyCoachRecord';
import {
  useCoachCommunityAnnouncementChannels,
  usePublishCommunityPost,
} from '@/features/communities/hooks/useCommunities';
import { triggerLightImpact, triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import type { CommunityChannelItem, CommunityPostItem } from '@/types/domain';

type FieldGroupProps = {
  label: string;
  children: React.ReactNode;
};

function FieldGroup({ label, children }: FieldGroupProps) {
  const { colors, typography, gap } = useTheme();

  return (
    <View style={{ gap: gap.sm }}>
      <Text style={[typography.textPresets.metricLabel, { color: colors.text.tertiary }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

export type CommunityAnnouncementComposerProps = {
  onPublished?: () => void;
  onDismiss?: () => void;
  variant?: 'sheet' | 'screen';
};

export function CommunityAnnouncementComposer({
  onPublished,
  onDismiss,
  variant = 'screen',
}: CommunityAnnouncementComposerProps) {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const router = useRouter();
  const { coach } = useMyCoachRecord();
  const channelsQuery = useCoachCommunityAnnouncementChannels();
  const publishMutation = usePublishCommunityPost(coach?.id ?? '');

  const channels = channelsQuery.data ?? [];
  const [channelId, setChannelId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinOnPublish, setPinOnPublish] = useState(true);

  const isSheet = variant === 'sheet';
  const sheetMaxHeight = Math.round(windowHeight * 0.9);

  useEffect(() => {
    if (!channelId && channels[0]?.id) {
      setChannelId(channels[0].id);
    }
  }, [channelId, channels]);

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
      myReactions: [],
    };
  }, [body, coach?.id, coach?.name, coach?.photoUrl, pinOnPublish, selectedChannelId, title]);

  const errorMessage =
    publishMutation.error instanceof Error ? publishMutation.error.message : null;

  const canPublish = Boolean(selectedChannelId && body.trim());
  const isPublishing = publishMutation.isPending;

  const handlePublish = useCallback(() => {
    const trimmedBody = body.trim();
    if (!selectedChannelId || !trimmedBody || isPublishing) return;

    triggerLightImpact();
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
  }, [body, isPublishing, onPublished, pinOnPublish, publishMutation, selectedChannelId, title]);

  if (channelsQuery.isLoading) {
    return <StateBlock kind="loading" title="Loading communities" />;
  }

  if (channelsQuery.isError) {
    return (
      <StateBlock
        kind="error"
        title="Could not load communities"
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
        title="No communities available"
        message="Ask academy staff to link your coach profile to a discipline before posting announcements."
        actionLabel="Open communities"
        onAction={() => router.push('/(coach)/communities')}
      />
    );
  }

  const formContent = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={isSheet ? styles.scroll : styles.screenScroll}
      contentContainerStyle={{ gap: gap.lg, paddingBottom: isSheet ? gap.sm : inset.lg }}
    >
      <FieldGroup label="COMMUNITY">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chipRow, { gap: gap.sm }]}
        >
          {channels.map((channel: CommunityChannelItem) => (
            <Chip
              key={channel.id}
              label={channel.disciplineName || channel.title}
              active={channel.id === selectedChannelId}
              onPress={() => setChannelId(channel.id)}
            />
          ))}
        </ScrollView>
      </FieldGroup>

      <View style={{ gap: gap.md }}>
        <Text style={[typography.textPresets.metricLabel, { color: colors.text.tertiary }]}>
          DETAILS
        </Text>

        <TextField
          label="Title (optional)"
          value={title}
          onChangeText={setTitle}
          containerStyle={styles.field}
        />
        <TextField
          label="Announcement"
          value={body}
          onChangeText={setBody}
          multiline
          placeholder="Share schedule updates, technique notes, or event info…"
          containerStyle={styles.field}
          style={styles.announcementInput}
        />
      </View>

      <FieldGroup label="OPTIONS">
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
              Replaces the current pinned announcement in this community.
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
      </FieldGroup>

      {previewPost ? (
        <FieldGroup label="PREVIEW">
          <CommunityAnnouncementCard post={previewPost} readOnly />
        </FieldGroup>
      ) : null}

      {errorMessage ? (
        <Text style={{ color: colors.status.error, fontSize: 13 }}>{errorMessage}</Text>
      ) : null}

      {!isSheet && selectedChannelId ? (
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
    </ScrollView>
  );

  const footer = (
    <View
      style={[
        styles.footer,
        {
          borderTopColor: colors.border.subtle,
          paddingTop: inset.md,
          paddingBottom: isSheet ? safeInsets.bottom + inset.lg : 0,
          gap: gap.xs,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Publish announcement"
        accessibilityState={{ disabled: !canPublish || isPublishing }}
        disabled={!canPublish || isPublishing}
        onPress={handlePublish}
        style={({ pressed }) => [
          styles.primaryButton,
          {
            backgroundColor: colors.accent.default,
            borderRadius: radius.pill,
            opacity: !canPublish || isPublishing ? 0.45 : pressed ? 0.88 : 1,
          },
        ]}
      >
        {isPublishing ? (
          <ActivityIndicator color={colors.accent.onAccent} />
        ) : (
          <Text style={[typography.textPresets.button, { color: colors.accent.onAccent }]}>
            Publish announcement
          </Text>
        )}
      </Pressable>

      {isSheet && onDismiss ? (
        <AppBottomSheetButton label="Not now" variant="secondary" onPress={onDismiss} />
      ) : null}
    </View>
  );

  if (isSheet) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.flex, { maxHeight: sheetMaxHeight }]}
      >
        <View style={{ gap: gap.xs }}>
          <TabHeroTitle
            lines={[[{ text: 'New ' }, { text: 'announcement.', accent: true }]]}
          />
          <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
          Eligible members receive an in-app notification and push alert.
          </Text>
        </View>

        {formContent}
        {footer}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.root, { flex: 1, padding: inset.lg, gap: gap.lg }]}>
      <View style={{ gap: gap.xs }}>
        <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
          Post announcement
        </Text>
        <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
          Members in this discipline community receive a notification when you publish.
        </Text>
      </View>

      {formContent}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  flex: {
    flexShrink: 1,
    minHeight: 0,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  screenScroll: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    paddingRight: 4,
  },
  field: {
    marginBottom: 0,
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
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
  },
});
