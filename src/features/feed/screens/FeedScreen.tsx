import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StateBlock } from '@/shared/components/StateBlock';
import { toast } from '@/shared/components/Toast';
import { useDialog } from '@/shared/components/Dialog';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { useTabEntrance } from '@/shared/navigation/useTabEntranceReplay';
import { useTheme } from '@/shared/theme';
import { triggerLightImpact } from '@/shared/haptics';
import {
  isOfflineWithoutCache,
  isQueryActivelyLoading,
  OFFLINE_MESSAGE,
  OFFLINE_TITLE,
} from '@/lib/offlineState';
import {
  useDeleteFeedPost,
  useFeedDisciplines,
  useFeedPosts,
  useRecordFeedShare,
  useToggleFeedLike,
} from '@/features/feed/hooks/useFeed';
import type { FeedMediaItem, FeedPost } from '@/features/feed/types';
import { FeedDisciplineFilter } from '@/features/feed/components/FeedDisciplineFilter';
import { FeedImageViewerModal } from '@/features/feed/components/FeedImageViewerModal';
import { FeedLikesBottomSheet } from '@/features/feed/components/FeedLikesBottomSheet';
import { FeedPostList } from '@/features/feed/components/FeedPostList';
import { FeedSectionHeader } from '@/features/feed/components/FeedSectionHeader';
import { FeedSkeleton } from '@/features/feed/components/FeedSkeleton';
import { useActiveMemberId, useIsViewingChildProfile } from '@/hooks/useActiveMemberId';

export function FeedScreen() {
  const { colors, inset, gap, layout } = useTheme();
  const router = useRouter();
  const activeMemberId = useActiveMemberId();
  const viewingChild = useIsViewingChildProfile();
  const topInset = useAppTopInset();
  const { contentBottomInset } = useResponsiveLayout();
  const { entranceSignal } = useTabEntrance();
  const { showConfirm } = useDialog();
  const { isOnline, networkStatusKnown } = useNetworkStatus();
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [likesPostId, setLikesPostId] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState<{ items: FeedMediaItem[]; index: number } | null>(
    null,
  );
  const loadingMoreRef = useRef(false);
  const feedFilterKey = selectedDisciplineId ?? 'all';

  const disciplinesQuery = useFeedDisciplines();
  const feedQuery = useFeedPosts(selectedDisciplineId, {
    authorId: viewingChild ? activeMemberId : null,
  });
  const likeMutation = useToggleFeedLike();
  const deleteMutation = useDeleteFeedPost();
  const shareMutation = useRecordFeedShare();

  const posts = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.posts) ?? [],
    [feedQuery.data?.pages],
  );
  const pageDisciplines = feedQuery.data?.pages[0]?.disciplines ?? [];
  const disciplines = disciplinesQuery.data?.length ? disciplinesQuery.data : pageDisciplines;

  const headerBottom = topInset + layout.appHeaderHeight + layout.appHeaderTopInset;
  const screenPaddingTop = headerBottom + 12;
  const screenPadding = useMemo(
    () => ({
      paddingHorizontal: inset.lg,
      paddingTop: screenPaddingTop,
      paddingBottom: contentBottomInset + 120,
    }),
    [contentBottomInset, inset.lg, screenPaddingTop],
  );

  const handleRefresh = useCallback(async () => {
    triggerLightImpact();
    setRefreshing(true);
    try {
      await Promise.all([disciplinesQuery.refetch(), feedQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [disciplinesQuery, feedQuery]);

  const handleEndReached = useCallback(() => {
    if (loadingMoreRef.current || !feedQuery.hasNextPage || feedQuery.isFetchingNextPage) return;
    loadingMoreRef.current = true;
    void feedQuery.fetchNextPage().finally(() => {
      loadingMoreRef.current = false;
    });
  }, [feedQuery]);

  const handleShare = useCallback(
    async (post: FeedPost) => {
      try {
        await Share.share({
          message: `${post.authorName} in ${post.disciplineName}: ${post.body}`,
        });
        shareMutation.mutate(post.id);
      } catch {
        toast.error('Could not share post', 'Please try again.');
      }
    },
    [shareMutation],
  );

  const handleDelete = useCallback(
    (post: FeedPost) => {
      showConfirm(
        'Delete post?',
        'This removes the post and its comments from the feed.',
        () => deleteMutation.mutate(post.id),
        { confirmLabel: 'Delete', destructive: true },
      );
    },
    [deleteMutation, showConfirm],
  );

  const handleLike = useCallback(
    (post: FeedPost) => {
      likeMutation.mutate(post);
    },
    [likeMutation],
  );

  const handleOpenLikes = useCallback((post: FeedPost) => {
    setLikesPostId(post.id);
  }, []);

  const handlePressImage = useCallback((media: FeedMediaItem[], index: number) => {
    setActiveMedia({ items: media, index });
  }, []);

  const listHeader = useMemo(
    () => (
      <View style={{ gap: gap.md, marginBottom: gap.lg }}>
        <FeedSectionHeader
          onSearch={viewingChild ? undefined : () => router.push('/feed/search')}
          onNewPost={() => router.push('/feed/new')}
          variant={viewingChild ? 'child' : 'academy'}
        />
        <FeedDisciplineFilter
          disciplines={disciplines}
          selectedId={selectedDisciplineId}
          onSelect={setSelectedDisciplineId}
        />
      </View>
    ),
    [disciplines, gap.lg, gap.md, router, selectedDisciplineId, viewingChild],
  );

  const isInitialLoading =
    posts.length === 0 && isQueryActivelyLoading(feedQuery.isLoading, feedQuery.isFetching);
  const hasError = feedQuery.isError || disciplinesQuery.isError;
  const hasData = feedQuery.data !== undefined;
  const isOfflineBlocked = isOfflineWithoutCache({
    networkStatusKnown,
    isOnline,
    hasData,
    hasError,
  });

  if (isOfflineBlocked) {
    return (
      <View
        style={[
          styles.safe,
          styles.centered,
          { backgroundColor: colors.background.primary, padding: inset.lg },
        ]}
      >
        <StateBlock
          kind="error"
          title={OFFLINE_TITLE}
          message={OFFLINE_MESSAGE}
          actionLabel="Retry"
          onAction={handleRefresh}
          offlineAwareRetry
        />
      </View>
    );
  }

  if (hasError && !hasData && !isInitialLoading) {
    return (
      <View
        style={[
          styles.safe,
          styles.centered,
          { backgroundColor: colors.background.primary, padding: inset.lg },
        ]}
      >
        <StateBlock
          kind="error"
          title="Could not load feed"
          message="Check your connection and try again."
          actionLabel="Retry"
          onAction={handleRefresh}
          offlineAwareRetry
        />
      </View>
    );
  }

  if (isInitialLoading) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
        <View style={screenPadding}>
          {listHeader}
          <FeedSkeleton />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
      <FeedPostList
        filterKey={feedFilterKey}
        posts={posts}
        listHeader={listHeader}
        contentContainerStyle={screenPadding}
        entranceSignal={entranceSignal}
        viewingChild={viewingChild}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        progressViewOffset={headerBottom}
        isFetchingNextPage={feedQuery.isFetchingNextPage}
        onLoadMore={handleEndReached}
        onLike={handleLike}
        onOpenLikes={handleOpenLikes}
        onShare={handleShare}
        onDelete={handleDelete}
        onPressImage={handlePressImage}
      />

      <FeedLikesBottomSheet
        postId={likesPostId}
        visible={Boolean(likesPostId)}
        onClose={() => setLikesPostId(null)}
        onSelectUser={(userId) => router.push(`/feed/user/${userId}`)}
      />

      <FeedImageViewerModal
        visible={Boolean(activeMedia)}
        media={activeMedia?.items ?? []}
        initialIndex={activeMedia?.index ?? 0}
        onClose={() => setActiveMedia(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: {
    justifyContent: 'center',
  },
});
