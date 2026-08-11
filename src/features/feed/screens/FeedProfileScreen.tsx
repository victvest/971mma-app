import React, { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, Share, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { AppBar, Button, FlashListScrollComponent } from '@/shared/components/ui';
import {
  FLASH_LIST_ESTIMATES,
  flashListOverrideItemLayout,
} from '@/shared/constants/flashListEstimates';
import { StateBlock } from '@/shared/components/StateBlock';
import { toast } from '@/shared/components/Toast';
import { useDialog } from '@/shared/components/Dialog';
import { useFloatingAppBarContentInset } from '@/shared/hooks/useFloatingAppBarContentInset';
import { useTheme } from '@/shared/theme';
import {
  useDeleteFeedPost,
  useFeedProfile,
  useRecordFeedShare,
  useToggleFeedLike,
  useToggleFeedFollow,
} from '@/features/feed/hooks/useFeed';
import { useAuthStore } from '@/stores/useAuthStore';
import type { FeedPost } from '@/features/feed/types';
import { FeedPostCard } from '@/features/feed/components/FeedPostCard';
import { FeedProfileHeader } from '@/features/feed/components/FeedProfileHeader';
import { useActiveMemberId, useIsViewingChildProfile } from '@/hooks/useActiveMemberId';

type Props = {
  userId: string;
};

export function FeedProfileScreen({ userId }: Props) {
  const { colors, typography, inset, gap } = useTheme();
  const screenPaddingTop = useFloatingAppBarContentInset();
  const router = useRouter();
  const { showConfirm } = useDialog();
  const activeMemberId = useActiveMemberId();
  const viewingChild = useIsViewingChildProfile();
  const [refreshing, setRefreshing] = useState(false);
  const loadingMoreRef = useRef(false);

  const profileQuery = useFeedProfile(userId);
  const likeMutation = useToggleFeedLike();
  const deleteMutation = useDeleteFeedPost();
  const shareMutation = useRecordFeedShare();
  const followMutation = useToggleFeedFollow(userId);
  const authUserId = useAuthStore((state) => state.user?.id ?? '');
  const isOwnProfile = userId === (activeMemberId || authUserId);

  const pages = profileQuery.data?.pages ?? [];
  const profile = pages[0]?.profile ?? null;
  const posts = useMemo(() => pages.flatMap((page) => page.posts), [pages]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await profileQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [profileQuery]);

  const handleEndReached = useCallback(() => {
    if (loadingMoreRef.current || !profileQuery.hasNextPage || profileQuery.isFetchingNextPage) {
      return;
    }
    loadingMoreRef.current = true;
    void profileQuery.fetchNextPage().finally(() => {
      loadingMoreRef.current = false;
    });
  }, [profileQuery]);

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

  const renderItem = useCallback(
    ({ item }: { item: FeedPost }) => (
      <FeedPostCard
        post={item}
        onLike={(post) => likeMutation.mutate(post)}
        onOpenComments={(post) => router.push(`/feed/post/${post.id}`)}
        onOpenAuthor={(authorId) => {
          if (!viewingChild || authorId === activeMemberId) {
            router.push(`/feed/user/${authorId}`);
          }
        }}
        onShare={handleShare}
        onDelete={handleDelete}
        actionsMode={viewingChild ? 'comments-only' : 'full'}
      />
    ),
    [activeMemberId, handleDelete, handleShare, likeMutation, router, viewingChild],
  );

  const listHeader = useMemo(() => {
    if (!profile) return null;
    return (
      <View style={{ marginBottom: gap.lg }}>
        <FeedProfileHeader profile={profile} />
      </View>
    );
  }, [gap.lg, profile]);

  if (!userId) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
        <AppBar title="Profile" floating />
        <View style={[styles.centered, { padding: inset.lg }]}>
          <StateBlock kind="error" title="Profile unavailable" />
        </View>
      </View>
    );
  }

  if (profileQuery.isLoading && !profile) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
        <AppBar title="Profile" floating />
        <View style={[styles.centered, { padding: inset.lg }]}>
          <StateBlock kind="loading" title="Loading profile" />
        </View>
      </View>
    );
  }

  if (profileQuery.isError && !profile) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
        <AppBar title="Profile" floating />
        <View style={[styles.centered, { padding: inset.lg }]}>
          <StateBlock
            kind="error"
            title="Could not load profile"
            message="Check your connection and try again."
            actionLabel="Retry"
            onAction={handleRefresh}
            offlineAwareRetry
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
      <AppBar
        title="Profile"
        floating
        rightElement={
          !isOwnProfile && profile ? (
            <Button
              label={profile.isFollowing ? 'Unfollow' : 'Follow'}
              variant={profile.isFollowing ? 'outline' : 'primary'}
              size="sm"
              full={false}
              onPress={() => {
                followMutation.mutate(undefined, {
                  onError: () => {
                    toast.error('Could not update follow status', 'Please try again.');
                  },
                });
              }}
              loading={followMutation.isPending}
              style={{ minWidth: 90, height: 36 }}
            />
          ) : undefined
        }
      />
      <FlashList
        renderScrollComponent={FlashListScrollComponent}
        data={posts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <StateBlock
              kind="empty"
              title="No posts yet"
              message="Posts from this profile will appear here."
            />
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: gap.md }} />}
        ListFooterComponent={
          profileQuery.isFetchingNextPage ? (
            <Text
              style={[
                styles.footer,
                typography.textPresets.caption,
                { color: colors.text.tertiary },
              ]}
            >
              Loading more posts...
            </Text>
          ) : null
        }
        contentContainerStyle={{
          paddingHorizontal: inset.lg,
          paddingTop: screenPaddingTop,
          paddingBottom: inset['3xl'],
        }}
        overrideItemLayout={flashListOverrideItemLayout(FLASH_LIST_ESTIMATES.feedPostCard)}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent.default}
          />
        }
        drawDistance={360}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyWrap: {
    minHeight: 260,
    justifyContent: 'center',
  },
  footer: {
    paddingVertical: 18,
    textAlign: 'center',
  },
});
