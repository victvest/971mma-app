import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
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
  CommunityAnnouncementSheet,
  CommunityGroupsFab,
} from '@/features/communities/components';
import {
  useCommunityChannelFeedInfinite,
  useCommunityChannelHeader,
  useMarkCommunityChannelReadOnFocus,
  usePublishCommunityPost,
  useToggleCommunityReaction,
} from '@/features/communities/hooks/useCommunities';
import { useCommunityChannelRealtime } from '@/features/communities/hooks/useCommunityRealtime';
import {
  buildCommunityFeedRowsChronological,
  mergeCommunityFeedPosts,
  type CommunityFeedRow,
} from '@/features/communities/utils/community-feed-rows';
import { useMyCoachRecord } from '@/features/coach/hooks/useMyCoachRecord';
import { useIsViewingChildProfile } from '@/hooks/useActiveMemberId';
import { StateBlock } from '@/shared/components/StateBlock';
import { toast } from '@/shared/components/Toast';
import { useTheme } from '@/shared/theme';
import type { CommunityPostItem } from '@/types/domain';

type FeedPostItemProps = {
  post: CommunityPostItem;
  channelId: string;
  readOnly: boolean;
  onOpenThread: (postId: string) => void;
};

const FeedPostItem = memo(function FeedPostItem({
  post,
  channelId,
  readOnly,
  onOpenThread,
}: FeedPostItemProps) {
  const reactionMutation = useToggleCommunityReaction(post.id, channelId);

  return (
    <CommunityFeedMessage
      post={post}
      readOnly={readOnly}
      onPress={() => onOpenThread(post.id)}
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
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const listRef = useRef<FlashListRef<CommunityFeedRow>>(null);
  const didInitialScrollRef = useRef(false);

  const headerQuery = useCommunityChannelHeader(channelId, Boolean(channelId));
  const feedQuery = useCommunityChannelFeedInfinite(channelId, Boolean(channelId));
  const publishMutation = usePublishCommunityPost(coach?.id ?? '');

  const isCoachOwner = headerQuery.data?.isCoachOwner ?? false;
  const canCompose = isCoachOwner && !viewingChild;

  useMarkCommunityChannelReadOnFocus(channelId, Boolean(channelId));
  useCommunityChannelRealtime(channelId, Boolean(channelId));

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

  const previousCountRef = useRef(0);
  useEffect(() => {
    if (feedRows.length > previousCountRef.current && didInitialScrollRef.current) {
      scrollToLatest(true);
    }
    previousCountRef.current = feedRows.length;
  }, [feedRows.length, scrollToLatest]);

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
          onOpenThread={handleOpenThread}
        />
      );
    },
    [channelId, handleOpenThread, viewingChild],
  );

  const listHeader = useMemo(() => {
    if (!viewingChild) return null;

    return (
      <View
        style={[
          styles.listHeader,
          { gap: inset.sm, paddingBottom: inset.sm, paddingTop: inset.sm },
        ]}
      >
        {viewingChild ? (
          <View
            style={[
              styles.readOnlyNotice,
              {
                backgroundColor: colors.fill.secondary,
                borderColor: colors.border.subtle,
                marginHorizontal: inset.lg,
              },
            ]}
          >
            <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '700' }}>
              Viewing trainee profile - read-only.
            </Text>
          </View>
        ) : null}
      </View>
    );
  }, [
    colors.border.subtle,
    colors.fill.secondary,
    colors.text.secondary,
    inset.lg,
    inset.sm,
    viewingChild,
  ]);

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

      <View style={styles.body}>
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
              placeholder={canCompose ? 'Post an announcement...' : undefined}
              readOnlyHint={
                viewingChild
                  ? 'Family view is read-only.'
                  : 'Open an announcement to join the thread.'
              }
            />
          }
        />
        {canCompose ? (
          <CommunityGroupsFab bottomOffset={72} onPress={() => setAnnouncementOpen(true)} />
        ) : null}
      </View>

      <CommunityAnnouncementSheet
        visible={announcementOpen}
        onDismiss={() => setAnnouncementOpen(false)}
        initialChannelId={channelId}
        lockChannel
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1 },
  listHeader: {
    width: '100%',
  },
  readOnlyNotice: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  footerLoader: {
    alignItems: 'center',
    paddingVertical: 16,
  },
});
