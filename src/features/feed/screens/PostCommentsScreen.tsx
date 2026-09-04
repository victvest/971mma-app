import React, { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, Share, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { AppBar, FlashListScrollComponent } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { toast } from '@/shared/components/Toast';
import { useDialog } from '@/shared/components/Dialog';
import { triggerLightImpact, triggerSuccessNotification } from '@/shared/haptics';
import { useFloatingAppBarContentInset } from '@/shared/hooks/useFloatingAppBarContentInset';
import { useKeyboardBottomInset } from '@/shared/hooks/useKeyboardBottomInset';
import { useTheme } from '@/shared/theme';
import { toUserFacingErrorMessage } from '@/lib/userFacingError';
import {
  useCreateFeedComment,
  useDeleteFeedComment,
  useDeleteFeedPost,
  useFeedComments,
  useFeedPostThread,
  useRecordFeedShare,
  useToggleFeedLike,
} from '@/features/feed/hooks/useFeed';
import type { FeedComment, FeedMediaItem, FeedPost } from '@/features/feed/types';
import { FeedCommentRow } from '@/features/feed/components/FeedCommentRow';
import { FeedImageViewerModal } from '@/features/feed/components/FeedImageViewerModal';
import { FeedLikesBottomSheet } from '@/features/feed/components/FeedLikesBottomSheet';
import { FeedPostCard } from '@/features/feed/components/FeedPostCard';
import {
  MAX_COMMENT_CHARS,
  PostCommentComposer,
} from '@/features/feed/components/PostCommentComposer';
import { useActiveMemberId, useIsViewingChildProfile } from '@/hooks/useActiveMemberId';

type Props = {
  postId: string;
};

export function PostCommentsScreen({ postId }: Props) {
  const { colors, typography, inset, gap } = useTheme();
  const screenPaddingTop = useFloatingAppBarContentInset();
  const keyboardInset = useKeyboardBottomInset();
  const router = useRouter();
  const { showConfirm } = useDialog();
  const activeMemberId = useActiveMemberId();
  const viewingChild = useIsViewingChildProfile();
  const scrollRef = useRef<ScrollView>(null);

  const [comment, setComment] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [composerHeight, setComposerHeight] = useState(80);
  const [likesPostId, setLikesPostId] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState<{ items: FeedMediaItem[]; index: number } | null>(
    null,
  );
  const loadingMoreRef = useRef(false);

  const childAuthorId = viewingChild ? activeMemberId : null;
  const threadQuery = useFeedPostThread(postId, { authorId: childAuthorId });
  const commentsQuery = useFeedComments(postId, { authorId: childAuthorId });
  const likeMutation = useToggleFeedLike();
  const shareMutation = useRecordFeedShare();
  const deletePostMutation = useDeleteFeedPost();
  const createCommentMutation = useCreateFeedComment(postId);
  const deleteCommentMutation = useDeleteFeedComment(postId);

  const comments = useMemo(
    () => commentsQuery.data?.pages.flatMap((page) => page.comments) ?? [],
    [commentsQuery.data?.pages],
  );
  const post = threadQuery.data?.post ?? null;
  const trimmedComment = comment.trim();
  const canSend =
    trimmedComment.length > 0 &&
    comment.length <= MAX_COMMENT_CHARS &&
    !createCommentMutation.isPending;

  const scrollToLatest = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([threadQuery.refetch(), commentsQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [commentsQuery, threadQuery]);

  const handleEndReached = useCallback(() => {
    if (loadingMoreRef.current || !commentsQuery.hasNextPage || commentsQuery.isFetchingNextPage) {
      return;
    }
    loadingMoreRef.current = true;
    void commentsQuery.fetchNextPage().finally(() => {
      loadingMoreRef.current = false;
    });
  }, [commentsQuery]);

  const handleShare = useCallback(
    async (targetPost: FeedPost) => {
      try {
        await Share.share({
          message: `${targetPost.authorName} in ${targetPost.disciplineName}: ${targetPost.body}`,
        });
        shareMutation.mutate(targetPost.id);
      } catch {
        toast.error('Could not share post', 'Please try again.');
      }
    },
    [shareMutation],
  );

  const handleDeletePost = useCallback(
    (targetPost: FeedPost) => {
      showConfirm(
        'Delete post?',
        'This removes the post and its comments from the feed.',
        () => {
          deletePostMutation.mutate(targetPost.id, {
            onSuccess: () => {
              router.back();
            },
          });
        },
        { confirmLabel: 'Delete', destructive: true },
      );
    },
    [deletePostMutation, router, showConfirm],
  );

  const handleDeleteComment = useCallback(
    (item: FeedComment) => {
      showConfirm(
        'Delete comment?',
        'This removes your comment from the post.',
        () => deleteCommentMutation.mutate(item.id),
        { confirmLabel: 'Delete', destructive: true },
      );
    },
    [deleteCommentMutation, showConfirm],
  );

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    triggerLightImpact();
    try {
      await createCommentMutation.mutateAsync(trimmedComment);
      setComment('');
      triggerSuccessNotification();
      scrollToLatest();
    } catch (error) {
      toast.error(
        'Could not comment',
        toUserFacingErrorMessage(error, { fallback: 'Please try again.' }),
      );
    }
  }, [canSend, createCommentMutation, scrollToLatest, trimmedComment]);

  const renderComment = useCallback(
    ({ item }: { item: FeedComment }) => (
      <FeedCommentRow
        comment={item}
        onOpenAuthor={
          viewingChild ? undefined : (authorId) => router.push(`/feed/user/${authorId}`)
        }
        onDelete={handleDeleteComment}
      />
    ),
    [handleDeleteComment, router, viewingChild],
  );

  const listHeader = useMemo(() => {
    if (!post) return null;
    return (
      <View style={{ gap: gap.lg }}>
        <FeedPostCard
          post={post}
          onLike={(item) => likeMutation.mutate(item)}
          onOpenLikes={(item) => setLikesPostId(item.id)}
          onOpenComments={() => undefined}
          onOpenAuthor={(authorId) => {
            if (!viewingChild) router.push(`/feed/user/${authorId}`);
          }}
          onShare={handleShare}
          onDelete={handleDeletePost}
          onPressImage={(media, index) => setActiveMedia({ items: media, index })}
          actionsMode={viewingChild ? 'none' : 'full'}
        />
        <View style={[styles.sectionHeader, { marginBottom: gap.md }]}>
          <Text style={[typography.textPresets.subtitle, { color: colors.text.primary }]}>
            Comments
          </Text>
          <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>
            {post.commentCount} total
          </Text>
        </View>
      </View>
    );
  }, [
    colors.text.primary,
    colors.text.tertiary,
    gap.lg,
    gap.md,
    handleDeletePost,
    handleShare,
    likeMutation,
    post,
    router,
    typography.textPresets.caption,
    typography.textPresets.subtitle,
    viewingChild,
  ]);

  const listContentPadding = useMemo(
    () => ({
      paddingHorizontal: inset.lg,
      paddingTop: screenPaddingTop,
      paddingBottom: composerHeight + inset.md,
    }),
    [composerHeight, inset.lg, inset.md, screenPaddingTop],
  );

  const renderScrollComponent = useCallback(
    (props: React.ComponentProps<typeof FlashListScrollComponent>) => (
      <FlashListScrollComponent
        {...props}
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      />
    ),
    [],
  );

  if (!postId) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
        <AppBar title="Comments" floating />
        <View style={[styles.centered, { padding: inset.lg }]}>
          <StateBlock
            kind="error"
            title="Post unavailable"
            message="This post could not be opened."
          />
        </View>
      </View>
    );
  }

  if (threadQuery.isLoading && !post) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
        <AppBar title="Comments" floating />
        <View style={[styles.centered, { padding: inset.lg }]}>
          <StateBlock kind="loading" title="Loading comments" />
        </View>
      </View>
    );
  }

  if (threadQuery.isError && !post) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
        <AppBar title="Comments" floating />
        <View style={[styles.centered, { padding: inset.lg }]}>
          <StateBlock
            kind="error"
            title="Could not load post"
            message="The post may have been removed or your connection dropped."
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
      <AppBar title="Comments" floating />

      <View style={styles.body}>
        <FlashList
          style={styles.list}
          renderScrollComponent={renderScrollComponent}
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            commentsQuery.isLoading ? (
              <StateBlock kind="loading" title="Loading comments" />
            ) : (
              <View style={styles.emptyWrap}>
                <StateBlock
                  kind="empty"
                  title="No comments yet"
                  message="Be the first to continue the training conversation."
                />
              </View>
            )
          }
          ListFooterComponent={
            commentsQuery.isFetchingNextPage ? (
              <Text
                style={[
                  styles.footer,
                  typography.textPresets.caption,
                  { color: colors.text.tertiary },
                ]}
              >
                Loading more comments...
              </Text>
            ) : null
          }
          ItemSeparatorComponent={() => <View style={{ height: gap.md }} />}
          contentContainerStyle={listContentPadding}
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

        {!viewingChild ? (
          <View pointerEvents="box-none" style={[styles.composerDock, { bottom: keyboardInset }]}>
            <PostCommentComposer
              value={comment}
              onChangeText={setComment}
              onSend={handleSend}
              canSend={canSend}
              isSending={createCommentMutation.isPending}
              onFocus={scrollToLatest}
              onMeasuredHeight={setComposerHeight}
            />
          </View>
        ) : null}
      </View>

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
  safe: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  composerDock: {
    left: 0,
    position: 'absolute',
    right: 0,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emptyWrap: {
    justifyContent: 'center',
    minHeight: 240,
  },
  footer: {
    paddingVertical: 18,
    textAlign: 'center',
  },
});
