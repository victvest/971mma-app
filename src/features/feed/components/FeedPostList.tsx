import React, { useCallback } from 'react';
import { RefreshControl, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import type { SharedValue } from 'react-native-reanimated';
import { ScrollRevealCard } from '@/shared/animations';
import {
  FLASH_LIST_ESTIMATES,
  flashListOverrideItemLayout,
} from '@/shared/constants/flashListEstimates';
import { FlashListScrollComponent } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';
import type { FeedPost } from '@/features/feed/types';
import { FeedPostCard } from '@/features/feed/components/FeedPostCard';
import { FeedSkeleton } from '@/features/feed/components/FeedSkeleton';

type Props = {
  /** Remounts the list when the feed filter changes so scroll always starts at the top. */
  filterKey: string;
  posts: FeedPost[];
  listHeader: React.ReactElement;
  contentContainerStyle: StyleProp<ViewStyle>;
  entranceSignal: SharedValue<number>;
  viewingChild: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onLike: (post: FeedPost) => void;
  onShare: (post: FeedPost) => void;
  onDelete: (post: FeedPost) => void;
};

export function FeedPostList({
  filterKey,
  posts,
  listHeader,
  contentContainerStyle,
  entranceSignal,
  viewingChild,
  refreshing,
  onRefresh,
  isFetchingNextPage,
  onLoadMore,
  onLike,
  onShare,
  onDelete,
}: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const hasData = posts.length > 0;

  const renderItem = useCallback(
    ({ item, index }: { item: FeedPost; index: number }) => (
      <ScrollRevealCard
        itemId={item.id}
        index={index}
        entranceSignal={entranceSignal}
        style={styles.itemWrap}
      >
        <FeedPostCard
          post={item}
          onLike={onLike}
          onOpenComments={(post) => router.push(`/feed/post/${post.id}`)}
          onOpenAuthor={(authorId) => router.push(`/feed/user/${authorId}`)}
          onShare={onShare}
          onDelete={onDelete}
          actionsMode={viewingChild ? 'comments-only' : 'full'}
        />
      </ScrollRevealCard>
    ),
    [entranceSignal, onDelete, onLike, onShare, router, viewingChild],
  );

  return (
    <FlashList
      key={filterKey}
      renderScrollComponent={FlashListScrollComponent}
      data={posts}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <StateBlock
            kind="empty"
            title={viewingChild ? 'No child posts yet' : 'No posts yet'}
            message={
              viewingChild
                ? 'Posts from this child profile will appear here.'
                : 'Share a training note, class photo, or question for your discipline.'
            }
          />
        </View>
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={styles.footer}>
            <FeedSkeleton />
          </View>
        ) : null
      }
      contentContainerStyle={[contentContainerStyle, !hasData ? styles.emptyContent : null]}
      overrideItemLayout={flashListOverrideItemLayout(FLASH_LIST_ESTIMATES.feedPostCard)}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.35}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent.default}
        />
      }
      drawDistance={360}
    />
  );
}

const styles = StyleSheet.create({
  itemWrap: {
    marginBottom: 16,
  },
  emptyContent: {
    flexGrow: 1,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 360,
  },
  footer: {
    paddingTop: 4,
  },
});
