import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlashListScrollComponent } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { toast } from '@/shared/components/Toast';
import { useDialog } from '@/shared/components/Dialog';
import { useTheme } from '@/shared/theme';
import {
  useDeleteFeedPost,
  useFeedSearch,
  useRecordFeedShare,
  useToggleFeedLike,
  useFeedDisciplines,
} from '@/features/feed/hooks/useFeed';
import type { FeedMediaItem, FeedPost, FeedSearchUser } from '@/features/feed/types';
import { FeedImageViewerModal } from '@/features/feed/components/FeedImageViewerModal';
import { FeedLikesBottomSheet } from '@/features/feed/components/FeedLikesBottomSheet';
import { FeedPostCard } from '@/features/feed/components/FeedPostCard';
import { FeedSearchChrome } from '@/features/feed/components/FeedSearchChrome';
import { FeedUserRow } from '@/features/feed/components/FeedUserRow';

type SearchRow =
  | { kind: 'heading'; id: string; label: string }
  | { kind: 'user'; id: string; user: FeedSearchUser }
  | { kind: 'post'; id: string; post: FeedPost };

const SEARCH_DEBOUNCE_MS = 260;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

type SearchLandingProps = {
  onSelectTag: (tag: string) => void;
};

function SearchLandingView({ onSelectTag }: SearchLandingProps) {
  const { colors, typography, radii, layout } = useTheme();
  const disciplinesQuery = useFeedDisciplines();
  const disciplines = disciplinesQuery.data ?? [];

  return (
    <View style={styles.landingContainer}>
      <View style={styles.landingHeader}>
        <View style={[styles.iconCircle, { backgroundColor: colors.surface.secondary }]}>
          <Ionicons name="search" size={30} color={colors.accent.default} />
        </View>
        <Text
          style={[
            typography.textPresets.title,
            styles.landingTitle,
            { color: colors.text.primary },
          ]}
        >
          Search the Academy
        </Text>
        <Text
          style={[
            typography.textPresets.body,
            styles.landingSubtitle,
            { color: colors.text.tertiary },
          ]}
        >
          Find posts, techniques, coaches, or fellow members.
        </Text>
      </View>

      {disciplines.length > 0 && (
        <View style={styles.section}>
          <Text
            style={[
              typography.textPresets.screenEyebrow,
              styles.sectionTitle,
              { color: colors.text.tertiary },
            ]}
          >
            Browse by Discipline
          </Text>
          <View style={styles.tagGrid}>
            {disciplines.map((d) => (
              <Pressable
                key={d.id}
                onPress={() => onSelectTag(d.displayName)}
                style={({ pressed }) => [
                  styles.tagCard,
                  {
                    backgroundColor: colors.surface.secondary,
                    borderColor: colors.border.subtle,
                    borderRadius: radii.md,
                    borderWidth: layout.borderWidth,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Ionicons
                  name="fitness"
                  size={14}
                  color={colors.accent.default}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}
                >
                  {d.displayName}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text
          style={[
            typography.textPresets.screenEyebrow,
            styles.sectionTitle,
            { color: colors.text.tertiary },
          ]}
        >
          Search Tips
        </Text>
        <View style={styles.tipsList}>
          <View style={styles.tipRow}>
            <Ionicons
              name="people-outline"
              size={16}
              color={colors.text.secondary}
              style={styles.tipIcon}
            />
            <Text
              style={[typography.textPresets.footnote, { color: colors.text.secondary, flex: 1 }]}
            >
              {"Type a member's or coach's name to find their profile and training activity."}
            </Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons
              name="sparkles-outline"
              size={16}
              color={colors.text.secondary}
              style={styles.tipIcon}
            />
            <Text
              style={[typography.textPresets.footnote, { color: colors.text.secondary, flex: 1 }]}
            >
              {'Look up topics or moves like "guard pass", "sweep", or "takedown".'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function FeedSearchScreen() {
  const { colors, typography, inset, gap } = useTheme();
  const router = useRouter();
  const { showConfirm } = useDialog();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [likesPostId, setLikesPostId] = useState<string | null>(null);
  const [activeMedia, setActiveMedia] = useState<{ items: FeedMediaItem[]; index: number } | null>(
    null,
  );
  const loadingMoreRef = useRef(false);

  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, SEARCH_DEBOUNCE_MS);
  const isDebouncing = trimmedQuery !== debouncedQuery;
  const isQueryActive = trimmedQuery.length > 0;

  const searchQuery = useFeedSearch(debouncedQuery, 'all');
  const likeMutation = useToggleFeedLike();
  const deleteMutation = useDeleteFeedPost();
  const shareMutation = useRecordFeedShare();

  const isSuggestionMode = debouncedQuery.length < 2;
  const usersHeading = isSuggestionMode ? 'Members you know' : 'People';
  const postsHeading = isSuggestionMode ? 'Posts for you' : 'Posts';

  const rows = useMemo<SearchRow[]>(() => {
    const pages = searchQuery.data?.pages ?? [];
    const users = pages.flatMap((page) => page.users);
    const posts = pages.flatMap((page) => page.posts);
    const nextRows: SearchRow[] = [];

    if (users.length > 0) {
      nextRows.push({ kind: 'heading', id: 'heading-users', label: usersHeading });
      for (const user of users) {
        nextRows.push({ kind: 'user', id: `user-${user.id}`, user });
      }
    }

    if (posts.length > 0) {
      nextRows.push({ kind: 'heading', id: 'heading-posts', label: postsHeading });
      for (const post of posts) {
        nextRows.push({ kind: 'post', id: `post-${post.id}`, post });
      }
    }

    return nextRows;
  }, [postsHeading, searchQuery.data?.pages, usersHeading]);

  const showLanding = !isQueryActive && rows.length === 0;

  useFocusEffect(
    useCallback(() => {
      const frame = requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }, []),
  );

  const handleSelectTag = useCallback((tag: string) => {
    setQuery(tag);
    inputRef.current?.focus();
  }, []);

  const handleEndReached = useCallback(() => {
    if (loadingMoreRef.current || !searchQuery.hasNextPage || searchQuery.isFetchingNextPage) {
      return;
    }
    loadingMoreRef.current = true;
    void searchQuery.fetchNextPage().finally(() => {
      loadingMoreRef.current = false;
    });
  }, [searchQuery]);

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
    ({ item }: { item: SearchRow }) => {
      if (item.kind === 'heading') {
        return (
          <Text
            style={[
              typography.textPresets.metricLabel,
              styles.sectionHeading,
              { color: colors.text.tertiary },
            ]}
          >
            {item.label}
          </Text>
        );
      }

      if (item.kind === 'user') {
        return (
          <FeedUserRow user={item.user} onPress={(userId) => router.push(`/feed/user/${userId}`)} />
        );
      }

      return (
        <FeedPostCard
          post={item.post}
          onLike={(post) => likeMutation.mutate(post)}
          onOpenLikes={(post) => setLikesPostId(post.id)}
          onOpenComments={(post) => router.push(`/feed/post/${post.id}`)}
          onOpenAuthor={(authorId) => router.push(`/feed/user/${authorId}`)}
          onShare={handleShare}
          onDelete={handleDelete}
          onPressImage={(media, index) => setActiveMedia({ items: media, index })}
        />
      );
    },
    [
      colors.text.tertiary,
      handleDelete,
      handleShare,
      likeMutation,
      router,
      typography.textPresets.metricLabel,
    ],
  );

  const listHeader = useMemo(() => {
    if (!showLanding) return null;
    return <SearchLandingView onSelectTag={handleSelectTag} />;
  }, [handleSelectTag, showLanding]);

  const listEmpty = useMemo(() => {
    if (!isQueryActive || rows.length > 0) return null;

    if (searchQuery.isError) {
      return (
        <View style={styles.emptyWrap}>
          <StateBlock
            kind="error"
            title="Search failed"
            message="Check your connection and try again."
            actionLabel="Retry"
            onAction={() => searchQuery.refetch()}
            offlineAwareRetry
          />
        </View>
      );
    }

    if (isDebouncing || searchQuery.isFetching) {
      return (
        <View style={styles.emptyWrap}>
          <StateBlock kind="loading" title="Searching" />
        </View>
      );
    }

    if (debouncedQuery.length >= 2) {
      return (
        <View style={styles.emptyWrap}>
          <StateBlock
            kind="empty"
            title="No results"
            message="Try a member name, discipline, or training phrase."
          />
        </View>
      );
    }

    return null;
  }, [debouncedQuery.length, isDebouncing, isQueryActive, rows.length, searchQuery]);

  return (
    <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
      <FeedSearchChrome query={query} onChangeQuery={setQuery} inputRef={inputRef} />

      <View style={styles.body}>
        <FlashList
          renderScrollComponent={FlashListScrollComponent}
          data={rows}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          ItemSeparatorComponent={() => <View style={{ height: gap.md }} />}
          ListFooterComponent={
            searchQuery.isFetchingNextPage ? (
              <Text
                style={[
                  styles.footer,
                  typography.textPresets.caption,
                  { color: colors.text.tertiary },
                ]}
              >
                Loading more results...
              </Text>
            ) : null
          }
          contentContainerStyle={{
            paddingHorizontal: inset.lg,
            paddingTop: inset.md,
            paddingBottom: inset['3xl'],
            flexGrow: rows.length === 0 ? 1 : undefined,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.35}
          drawDistance={360}
        />
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
  safe: { flex: 1 },
  body: { flex: 1 },
  sectionHeading: {
    letterSpacing: 0.8,
    marginBottom: 2,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  emptyWrap: {
    justifyContent: 'center',
    minHeight: 240,
    paddingTop: 24,
  },
  landingContainer: {
    paddingVertical: 12,
    alignItems: 'stretch',
  },
  landingHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  landingTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  landingSubtitle: {
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    marginBottom: 12,
    letterSpacing: 1,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  tipsList: {
    gap: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  footer: {
    paddingVertical: 18,
    textAlign: 'center',
  },
});
