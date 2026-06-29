import React, { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
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
  useCommunityPostThread,
  useCreateCommunityReply,
  useToggleCommunityReaction,
} from '@/features/communities/hooks/useCommunities';
import { useIsViewingChildProfile } from '@/hooks/useActiveMemberId';
import { StateBlock } from '@/shared/components/StateBlock';
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

  const reactionMutation = useToggleCommunityReaction(resolvedPostId, channelId);
  const replyMutation = useCreateCommunityReply(resolvedPostId, channelId);

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

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
        <View style={{ paddingHorizontal: inset.lg, gap: gap.xs }}>
          <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '700' }}>
            Replies
          </Text>
          {replies.length === 0 ? (
            <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '500' }}>
              Start the thread with a question or encouragement.
            </Text>
          ) : null}
        </View>
      </View>
    );
  }, [colors.text.primary, colors.text.secondary, gap.lg, gap.md, gap.xs, inset.lg, post, reactionMutation, replies.length, viewingChild]);

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
});
