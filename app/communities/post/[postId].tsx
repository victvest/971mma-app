import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppBar, FlashListScrollComponent } from '@/shared/components/ui';
import {
  CommunityAnnouncementCard,
  CommunityChatComposer,
  CommunityChatLayout,
  CommunityMemberBubble,
} from '@/features/communities/components';
import {
  useCommunityChannelHeader,
  useCommunityPostThread,
  useCreateCommunityReply,
  useMarkCommunityChannelReadOnFocus,
  usePinCommunityPost,
  useToggleCommunityReaction,
  useUnpinCommunityPost,
} from '@/features/communities/hooks/useCommunities';
import { useCommunityThreadRealtime } from '@/features/communities/hooks/useCommunityRealtime';
import { useMyCoachRecord } from '@/features/coach/hooks/useMyCoachRecord';
import { useIsViewingChildProfile } from '@/hooks/useActiveMemberId';
import { StateBlock } from '@/shared/components/StateBlock';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import type { CommunityReplyItem } from '@/types/domain';

export default function CommunityPostThreadScreen() {
  const { colors, inset, gap } = useTheme();
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const resolvedPostId = typeof postId === 'string' ? postId : '';
  const viewingChild = useIsViewingChildProfile();

  const threadQuery = useCommunityPostThread(resolvedPostId, Boolean(resolvedPostId));
  const [replyBody, setReplyBody] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<FlashListRef<CommunityReplyItem>>(null);

  const post = threadQuery.data?.post ?? null;
  const replies = threadQuery.data?.replies ?? [];
  const channelId = post?.channelId ?? '';

  const { coach } = useMyCoachRecord();
  const headerQuery = useCommunityChannelHeader(channelId, Boolean(channelId));
  const reactionMutation = useToggleCommunityReaction(resolvedPostId, channelId);
  const replyMutation = useCreateCommunityReply(resolvedPostId, channelId);
  const pinMutation = usePinCommunityPost(channelId, coach?.id);
  const unpinMutation = useUnpinCommunityPost(channelId, coach?.id);
  const canModeratePost = Boolean(headerQuery.data?.isCoachOwner && !viewingChild && post);

  useMarkCommunityChannelReadOnFocus(channelId, Boolean(channelId));
  useCommunityThreadRealtime(resolvedPostId, channelId, Boolean(resolvedPostId));

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const previousReplyCountRef = useRef(0);
  useEffect(() => {
    if (replies.length > previousReplyCountRef.current && previousReplyCountRef.current > 0) {
      scrollToLatest(true);
    }
    previousReplyCountRef.current = replies.length;
  }, [replies.length, scrollToLatest]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await threadQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [threadQuery]);

  const handleReply = useCallback(() => {
    const body = replyBody.trim();
    if (!body || viewingChild) return;
    replyMutation.mutate(body, {
      onSuccess: () => {
        setReplyBody('');
        scrollToLatest(true);
      },
    });
  }, [replyBody, replyMutation, scrollToLatest, viewingChild]);

  const handleTogglePin = useCallback(() => {
    if (!post || !canModeratePost) return;
    triggerLightImpact();
    if (post.isPinned) {
      unpinMutation.mutate(post.id);
      return;
    }
    pinMutation.mutate(post.id);
  }, [canModeratePost, pinMutation, post, unpinMutation]);

  const renderReply = useCallback(
    ({ item }: { item: CommunityReplyItem }) => <CommunityMemberBubble reply={item} />,
    [],
  );

  const listHeader = useMemo(() => {
    if (!post) return null;

    return (
      <View style={{ gap: gap.lg, paddingBottom: gap.md }}>
        <CommunityAnnouncementCard
          post={post}
          readOnly={viewingChild}
          onReact={viewingChild ? undefined : (emoji) => reactionMutation.mutate(emoji)}
        />
        {canModeratePost ? (
          <Pressable
            onPress={handleTogglePin}
            disabled={pinMutation.isPending || unpinMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={post.isPinned ? 'Unpin announcement' : 'Pin announcement'}
            style={[
              styles.moderationRow,
              {
                borderColor: colors.border.subtle,
                marginHorizontal: inset.lg,
                paddingHorizontal: inset.md,
                paddingVertical: inset.sm,
                gap: gap.sm,
              },
            ]}
          >
            <Ionicons
              name={post.isPinned ? 'pin' : 'pin-outline'}
              size={16}
              color={colors.accent.default}
            />
            <Text style={{ color: colors.accent.default, fontSize: 13, fontWeight: '700' }}>
              {post.isPinned ? 'Unpin announcement' : 'Pin announcement'}
            </Text>
          </Pressable>
        ) : null}
        <View
          style={[
            styles.threadHeader,
            {
              backgroundColor: colors.surface.primary,
              borderColor: colors.border.subtle,
              marginHorizontal: inset.lg,
            },
          ]}
        >
          <View style={[styles.threadTitleRow, { gap: gap.sm }]}>
            <View style={[styles.threadIcon, { backgroundColor: colors.accent.subtle }]}>
              <Ionicons name="chatbubble-ellipses" size={15} color={colors.accent.default} />
            </View>
            <View style={styles.threadCopy}>
              <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '800' }}>
                Replies
              </Text>
              <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '600' }}>
                {replies.length === 0
                  ? viewingChild
                    ? 'No replies yet.'
                    : 'Start the thread with a question or encouragement.'
                  : `${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}`}
              </Text>
            </View>
          </View>
          {viewingChild ? (
            <Text style={{ color: colors.text.tertiary, fontSize: 12, fontWeight: '700' }}>
              Family view is read-only.
            </Text>
          ) : null}
        </View>
      </View>
    );
  }, [
    colors.accent.default,
    colors.accent.subtle,
    colors.border.subtle,
    colors.surface.primary,
    colors.text.primary,
    colors.text.secondary,
    colors.text.tertiary,
    gap.lg,
    gap.md,
    gap.sm,
    handleTogglePin,
    canModeratePost,
    inset.lg,
    pinMutation.isPending,
    post,
    reactionMutation,
    replies.length,
    unpinMutation.isPending,
    viewingChild,
  ]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top']}
    >
      <AppBar title="Thread" showBackButton />

      {threadQuery.isLoading ? (
        <View style={[styles.centered, { padding: inset.lg }]}>
          <StateBlock kind="loading" title="Loading thread" />
        </View>
      ) : threadQuery.isError || !post ? (
        <View style={[styles.centered, { padding: inset.lg }]}>
          <StateBlock
            kind="error"
            title="Could not load thread"
            message="This announcement may have been removed."
            actionLabel="Go back"
            onAction={() => router.back()}
          />
        </View>
      ) : (
        <CommunityChatLayout
          onKeyboardShow={() => scrollToLatest(true)}
          list={
            <FlashList
              ref={listRef}
              renderScrollComponent={FlashListScrollComponent}
              data={replies}
              keyExtractor={(item) => item.id}
              renderItem={renderReply}
              ListHeaderComponent={listHeader}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              contentContainerStyle={{
                paddingTop: inset.md,
                paddingBottom: inset.md,
                paddingHorizontal: inset.sm,
              }}
            />
          }
          composer={
            <CommunityChatComposer
              value={replyBody}
              onChangeText={setReplyBody}
              onSend={handleReply}
              placeholder="Reply…"
              sending={replyMutation.isPending}
              readOnly={viewingChild}
              readOnlyHint="Viewing trainee profile — replies are disabled."
              disabled={replyMutation.isPending}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  threadHeader: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  threadTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  threadIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  threadCopy: {
    flex: 1,
    minWidth: 0,
  },
  moderationRow: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
