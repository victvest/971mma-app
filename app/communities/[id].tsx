import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppBar, FlashListScrollComponent } from '@/shared/components/ui';
import {
  CommunityChatComposer,
  CommunityChatLayout,
  CommunityDateSeparator,
  CommunityFeedMessage,
  CommunityFeedSkeleton,
} from '@/features/communities/components';
import {
  useCommunityChannelFeedInfinite,
  useCommunityChannelHeader,
  useMarkCommunityChannelReadOnFocus,
  usePinCommunityPost,
  usePublishCommunityPost,
  useToggleCommunityReaction,
  useUnpinCommunityPost,
} from '@/features/communities/hooks/useCommunities';
import {
  buildCommunityFeedRowsChronological,
  mergeCommunityFeedPosts,
  type CommunityFeedRow,
} from '@/features/communities/utils/community-feed-rows';
import { useMyCoachRecord } from '@/features/coach/hooks/useMyCoachRecord';
import { useIsViewingChildProfile } from '@/hooks/useActiveMemberId';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { StateBlock } from '@/shared/components/StateBlock';
import { toast } from '@/shared/components/Toast';
import { useTheme } from '@/shared/theme';
import type { CommunityPostItem } from '@/types/domain';

type FeedPostItemProps = {
  post: CommunityPostItem;
  channelId: string;
  readOnly: boolean;
  isCoachOwner: boolean;
  onOpenThread: (postId: string) => void;
  onCoachManagePost?: (post: CommunityPostItem) => void;
};

const FeedPostItem = memo(function FeedPostItem({
  post,
  channelId,
  readOnly,
  isCoachOwner,
  onOpenThread,
  onCoachManagePost,
}: FeedPostItemProps) {
  const reactionMutation = useToggleCommunityReaction(post.id, channelId);

  return (
    <CommunityFeedMessage
      post={post}
      readOnly={readOnly}
      onPress={() => onOpenThread(post.id)}
      onLongPress={
        isCoachOwner && post.authorRole === 'coach' && onCoachManagePost
          ? () => onCoachManagePost(post)
          : undefined
      }
      onOpenThread={() => onOpenThread(post.id)}
      onReact={readOnly ? undefined : (emoji) => reactionMutation.mutate(emoji)}
    />
  );
});

export default function CommunityChannelScreen() {
  const { colors, inset } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const channelId = typeof id === 'string' ? id : '';
  const viewingChild = useIsViewingChildProfile();
  const { coach } = useMyCoachRecord();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const listRef = useRef<FlashListRef<CommunityFeedRow>>(null);
  const didInitialScrollRef = useRef(false);

  const headerQuery = useCommunityChannelHeader(channelId, Boolean(channelId));
  const feedQuery = useCommunityChannelFeedInfinite(channelId, Boolean(channelId));
  const publishMutation = usePublishCommunityPost(coach?.id ?? '');
  const pinMutation = usePinCommunityPost(channelId, coach?.id);
  const unpinMutation = useUnpinCommunityPost(channelId, coach?.id);

  const isCoachOwner = headerQuery.data?.isCoachOwner ?? false;
  const canCompose = isCoachOwner && !viewingChild;

  useMarkCommunityChannelReadOnFocus(channelId, Boolean(channelId));

  const posts = useMemo(
    () => mergeCommunityFeedPosts(feedQuery.data?.pages ?? []),
    [feedQuery.data?.pages],
  );
  const feedRows = useMemo(
    () => buildCommunityFeedRowsChronological([...posts].reverse()),
    [posts],
  );

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    didInitialScrollRef.current = false;
  }, [channelId]);

  useEffect(() => {
    if (feedRows.length === 0 || feedQuery.isLoading || didInitialScrollRef.current) return;

    didInitialScrollRef.current = true;
    scrollToLatest(false);
  }, [feedQuery.isLoading, feedRows.length, scrollToLatest]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([headerQuery.refetch(), feedQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [feedQuery, headerQuery]);

  const handleOpenThread = useCallback(
    (postId: string) => {
      router.push(`/communities/post/${postId}`);
    },
    [router],
  );

  const handleLoadOlder = useCallback(() => {
    if (!feedQuery.hasNextPage || feedQuery.isFetchingNextPage) return;
    void feedQuery.fetchNextPage();
  }, [feedQuery]);

  const handleSend = useCallback(() => {
    const body = message.trim();
    if (!body || !canCompose || !coach?.id) return;

    publishMutation.mutate(
      {
        channelId,
        body,
        postKind: 'announcement',
      },
      {
        onSuccess: () => {
          setMessage('');
          scrollToLatest(true);
        },
        onError: () => {
          toast.error('Could not send', 'Please try again.');
        },
      },
    );
  }, [canCompose, channelId, coach?.id, message, publishMutation, scrollToLatest]);

  const handleCoachManagePost = useCallback(
    (post: CommunityPostItem) => {
      triggerSelectionHaptic();
      Alert.alert(
        post.isPinned ? 'Pinned message' : 'Message',
        post.title ?? post.body.slice(0, 120),
        [
          post.isPinned
            ? {
                text: 'Unpin',
                onPress: () => unpinMutation.mutate(post.id),
              }
            : {
                text: 'Pin',
                onPress: () => pinMutation.mutate(post.id),
              },
          {
            text: 'Open thread',
            onPress: () => handleOpenThread(post.id),
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    },
    [handleOpenThread, pinMutation, unpinMutation],
  );

  const renderItem = useCallback(
    ({ item }: { item: CommunityFeedRow }) => {
      if (item.type === 'date') {
        return <CommunityDateSeparator iso={item.iso} />;
      }

      return (
        <FeedPostItem
          post={item.post}
          channelId={channelId}
          readOnly={viewingChild}
          isCoachOwner={isCoachOwner}
          onOpenThread={handleOpenThread}
          onCoachManagePost={isCoachOwner ? handleCoachManagePost : undefined}
        />
      );
    },
    [channelId, handleCoachManagePost, handleOpenThread, isCoachOwner, viewingChild],
  );

  const listHeader = useMemo(() => {
    if (!viewingChild) return null;

    return (
      <View style={{ paddingBottom: inset.sm, paddingHorizontal: inset.lg, paddingTop: inset.xs }}>
        <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '500' }}>
          Viewing trainee profile — read-only.
        </Text>
      </View>
    );
  }, [colors.text.secondary, inset.lg, inset.sm, inset.xs, viewingChild]);

  const listFooter = useMemo(() => {
    if (!feedQuery.isFetchingNextPage) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.accent.default} />
      </View>
    );
  }, [colors.accent.default, feedQuery.isFetchingNextPage]);

  const listEmpty = useMemo(() => {
    if (feedQuery.isLoading || headerQuery.isLoading) {
      return <CommunityFeedSkeleton />;
    }

    if (feedQuery.isError || headerQuery.isError) {
      return (
        <View style={{ paddingHorizontal: inset.lg }}>
          <StateBlock
            kind="error"
            title="Could not load group"
            message="Please check your connection and try again."
            actionLabel="Retry"
            onAction={() => {
              void headerQuery.refetch();
              void feedQuery.refetch();
            }}
          />
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: inset.lg }}>
        <StateBlock
          kind="empty"
          title="No messages yet"
          message={canCompose ? 'Be the first to say something.' : 'Your coach has not posted yet.'}
        />
      </View>
    );
  }, [canCompose, feedQuery, headerQuery, inset.lg]);

  const screenTitle = headerQuery.data?.disciplineName ?? headerQuery.data?.title ?? 'Group';

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top']}
    >
      <AppBar title={screenTitle} showBackButton />

      <CommunityChatLayout
        onKeyboardShow={() => scrollToLatest(true)}
        list={
          <FlashList
            ref={listRef}
            renderScrollComponent={FlashListScrollComponent}
            data={feedQuery.isLoading || feedQuery.isError ? [] : feedRows}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            ListEmptyComponent={listEmpty}
            onStartReached={handleLoadOlder}
            onStartReachedThreshold={0.2}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            contentContainerStyle={{ paddingBottom: inset.sm, paddingTop: inset.xs }}
          />
        }
        composer={
          <CommunityChatComposer
            value={canCompose ? message : ''}
            onChangeText={setMessage}
            onSend={handleSend}
            sending={publishMutation.isPending}
            readOnly={!canCompose}
            placeholder={canCompose ? 'Message…' : undefined}
            readOnlyHint="Tap a message to reply in the thread."
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  footerLoader: {
    alignItems: 'center',
    paddingVertical: 16,
  },
});
