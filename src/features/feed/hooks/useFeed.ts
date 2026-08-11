import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import {
  createFeedComment,
  createFeedPost,
  deleteFeedComment,
  deleteFeedPost,
  getFeedPostThread,
  getFeedProfile,
  listFeedComments,
  listFeedDisciplines,
  listFeedPosts,
  recordFeedShare,
  searchFeed,
  toggleFeedLike,
  toggleFeedFollow,
} from '@/services/database/feed.repository';
import type {
  FeedComment,
  FeedCommentsPage,
  FeedCursor,
  FeedMediaItem,
  FeedPost,
  FeedPostsPage,
  FeedProfilePage,
  FeedSearchPage,
  FeedSearchType,
} from '@/features/feed/types';
import { FEED_PAGE_SIZE } from '@/features/feed/constants';
import { useAuthStore } from '@/stores/useAuthStore';
import { NOTIFICATIONS_STALE_MS } from '@/lib/queryCachePolicy';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';

const COMMENT_PAGE_SIZE = 20;

export const feedDisciplinesKey = ['feed-disciplines'] as const;
export const feedPostsKey = (
  userId: string,
  targetUserId: string,
  disciplineId: string | null,
  authorId: string | null,
) => ['feed-posts', userId, targetUserId, disciplineId ?? 'all', authorId ?? 'all'] as const;
export const feedThreadKey = (
  postId: string,
  targetUserId?: string | null,
  authorId?: string | null,
) => ['feed-thread', postId, targetUserId ?? 'self', authorId ?? 'all'] as const;
export const feedCommentsKey = (
  postId: string,
  targetUserId?: string | null,
  authorId?: string | null,
) => ['feed-comments', postId, targetUserId ?? 'self', authorId ?? 'all'] as const;
export const feedProfileKey = (userId: string, targetUserId?: string | null) =>
  ['feed-profile', userId, targetUserId ?? 'self'] as const;
export const feedSearchKey = (query: string, type: FeedSearchType) =>
  ['feed-search', query, type] as const;

function pageParamToCursor(pageParam: unknown): FeedCursor | null {
  if (!pageParam || typeof pageParam !== 'object') return null;
  const row = pageParam as FeedCursor;
  if (!row.cursor || !row.cursorId) return null;
  return row;
}

function nextPageParam(page: FeedCursor): FeedCursor | undefined {
  if (!page.cursor || !page.cursorId) return undefined;
  return { cursor: page.cursor, cursorId: page.cursorId };
}

function replacePost(posts: FeedPost[], next: FeedPost): FeedPost[] {
  return posts.map((post) => (post.id === next.id ? next : post));
}

function removePost(posts: FeedPost[], postId: string): FeedPost[] {
  return posts.filter((post) => post.id !== postId);
}

function updatePostInAllCaches(queryClient: QueryClient, next: FeedPost) {
  const feedQueries = queryClient.getQueriesData<InfiniteData<FeedPostsPage>>({
    queryKey: ['feed-posts'],
  });
  for (const [key, data] of feedQueries) {
    if (!data) continue;
    queryClient.setQueryData<InfiniteData<FeedPostsPage>>(key, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        posts: replacePost(page.posts, next),
      })),
    });
  }

  const profileQueries = queryClient.getQueriesData<InfiniteData<FeedProfilePage>>({
    queryKey: ['feed-profile'],
  });
  for (const [key, data] of profileQueries) {
    if (!data) continue;
    queryClient.setQueryData<InfiniteData<FeedProfilePage>>(key, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        posts: replacePost(page.posts, next),
      })),
    });
  }

  const searchQueries = queryClient.getQueriesData<InfiniteData<FeedSearchPage>>({
    queryKey: ['feed-search'],
  });
  for (const [key, data] of searchQueries) {
    if (!data) continue;
    queryClient.setQueryData<InfiniteData<FeedSearchPage>>(key, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        posts: replacePost(page.posts, next),
      })),
    });
  }

  const threadQueries = queryClient.getQueriesData<{
    post: FeedPost;
    comments: FeedComment[];
    cursor: FeedCursor;
  }>({ queryKey: ['feed-thread', next.id] });
  for (const [key, data] of threadQueries) {
    if (!data) continue;
    queryClient.setQueryData(key, { ...data, post: next });
  }
}

function removePostFromAllCaches(queryClient: QueryClient, postId: string) {
  const feedQueries = queryClient.getQueriesData<InfiniteData<FeedPostsPage>>({
    queryKey: ['feed-posts'],
  });
  for (const [key, data] of feedQueries) {
    if (!data) continue;
    queryClient.setQueryData<InfiniteData<FeedPostsPage>>(key, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        posts: removePost(page.posts, postId),
      })),
    });
  }

  const profileQueries = queryClient.getQueriesData<InfiniteData<FeedProfilePage>>({
    queryKey: ['feed-profile'],
  });
  for (const [key, data] of profileQueries) {
    if (!data) continue;
    queryClient.setQueryData<InfiniteData<FeedProfilePage>>(key, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        posts: removePost(page.posts, postId),
      })),
    });
  }
}

export function useFeedDisciplines() {
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const activeMemberId = useActiveMemberId();
  const targetUserId = activeMemberId || userId;

  return useQuery({
    queryKey: [...feedDisciplinesKey, userId, targetUserId],
    queryFn: () => listFeedDisciplines({ targetUserId }),
    enabled: Boolean(userId) && Boolean(targetUserId),
    staleTime: NOTIFICATIONS_STALE_MS,
  });
}

export function useFeedPosts(disciplineId: string | null, options?: { authorId?: string | null }) {
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const activeMemberId = useActiveMemberId();
  const targetUserId = activeMemberId || userId;
  const authorId = options?.authorId ?? null;

  return useInfiniteQuery({
    queryKey: feedPostsKey(userId, targetUserId, disciplineId, authorId),
    queryFn: ({ pageParam }) =>
      listFeedPosts({
        disciplineId,
        targetUserId,
        authorId,
        cursor: pageParamToCursor(pageParam),
        limit: FEED_PAGE_SIZE,
      }),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: nextPageParam,
    enabled: Boolean(userId) && Boolean(targetUserId),
    staleTime: NOTIFICATIONS_STALE_MS,
  });
}

export function useCreateFeedPost() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const activeMemberId = useActiveMemberId();
  const targetUserId = activeMemberId || userId;

  return useMutation({
    mutationFn: (input: { disciplineId: string; body: string; media: FeedMediaItem[] }) =>
      createFeedPost({ ...input, targetUserId }),
    onSuccess: (post) => {
      void queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      void queryClient.invalidateQueries({ queryKey: feedProfileKey(post.authorId, targetUserId) });
    },
  });
}

export function useDeleteFeedPost() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const activeMemberId = useActiveMemberId();
  const targetUserId = activeMemberId || userId;

  return useMutation({
    mutationFn: (postId: string) => deleteFeedPost({ postId, targetUserId }),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ['feed-posts'] });
      const previous = queryClient.getQueriesData<InfiniteData<FeedPostsPage>>({
        queryKey: ['feed-posts'],
      });
      removePostFromAllCaches(queryClient, postId);
      return { previous };
    },
    onError: (_error, _postId, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['feed-profile'] });
    },
  });
}

export function useToggleFeedLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (post: FeedPost) => toggleFeedLike(post.id),
    onMutate: async (post) => {
      await queryClient.cancelQueries({ queryKey: ['feed-posts'] });
      const previousFeed = queryClient.getQueriesData<InfiniteData<FeedPostsPage>>({
        queryKey: ['feed-posts'],
      });
      const previousProfile = queryClient.getQueriesData<InfiniteData<FeedProfilePage>>({
        queryKey: ['feed-profile'],
      });
      const previousThreads = queryClient.getQueriesData({ queryKey: ['feed-thread', post.id] });

      const optimistic: FeedPost = {
        ...post,
        myLiked: !post.myLiked,
        likeCount: Math.max(0, post.likeCount + (post.myLiked ? -1 : 1)),
      };
      updatePostInAllCaches(queryClient, optimistic);
      return { previousFeed, previousProfile, previousThreads, postId: post.id };
    },
    onError: (_error, _post, context) => {
      for (const [key, data] of context?.previousFeed ?? []) {
        queryClient.setQueryData(key, data);
      }
      for (const [key, data] of context?.previousProfile ?? []) {
        queryClient.setQueryData(key, data);
      }
      if (context?.postId) {
        for (const [key, data] of context.previousThreads ?? []) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSuccess: (post) => {
      updatePostInAllCaches(queryClient, post);
    },
  });
}

export function useRecordFeedShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recordFeedShare,
    onSuccess: (post) => updatePostInAllCaches(queryClient, post),
  });
}

export function useFeedPostThread(postId: string | null, options?: { authorId?: string | null }) {
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const activeMemberId = useActiveMemberId();
  const targetUserId = activeMemberId || userId;
  const authorId = options?.authorId ?? null;

  return useQuery({
    queryKey: feedThreadKey(postId ?? '', targetUserId, authorId),
    queryFn: () => getFeedPostThread({ postId: postId!, targetUserId, authorId }),
    enabled: Boolean(postId) && Boolean(targetUserId),
    staleTime: NOTIFICATIONS_STALE_MS,
  });
}

export function useFeedComments(postId: string | null, options?: { authorId?: string | null }) {
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const activeMemberId = useActiveMemberId();
  const targetUserId = activeMemberId || userId;
  const authorId = options?.authorId ?? null;

  return useInfiniteQuery({
    queryKey: feedCommentsKey(postId ?? '', targetUserId, authorId),
    queryFn: ({ pageParam }) =>
      listFeedComments({
        postId: postId!,
        targetUserId,
        authorId,
        cursor: pageParamToCursor(pageParam),
        limit: COMMENT_PAGE_SIZE,
      }),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: nextPageParam,
    enabled: Boolean(postId) && Boolean(targetUserId),
    staleTime: NOTIFICATIONS_STALE_MS,
  });
}

export function useCreateFeedComment(postId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const activeMemberId = useActiveMemberId();
  const targetUserId = activeMemberId || userId;

  return useMutation({
    mutationFn: (body: string) => createFeedComment({ postId, body }),
    onSuccess: ({ comment, post }) => {
      updatePostInAllCaches(queryClient, post);
      queryClient.setQueryData<InfiniteData<FeedCommentsPage>>(
        feedCommentsKey(postId, targetUserId),
        (current) => {
          if (!current?.pages[0]) return current;
          return {
            ...current,
            pages: current.pages.map((page, index) =>
              index === 0 ? { ...page, comments: [...page.comments, comment] } : page,
            ),
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: feedThreadKey(postId, targetUserId) });
    },
  });
}

export function useDeleteFeedComment(postId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const activeMemberId = useActiveMemberId();
  const targetUserId = activeMemberId || userId;

  return useMutation({
    mutationFn: deleteFeedComment,
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: feedCommentsKey(postId, targetUserId) });
      const previous = queryClient.getQueryData<InfiniteData<FeedCommentsPage>>(
        feedCommentsKey(postId, targetUserId),
      );
      queryClient.setQueryData<InfiniteData<FeedCommentsPage>>(
        feedCommentsKey(postId, targetUserId),
        (current) => {
          if (!current) return current;
          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              comments: page.comments.filter((comment) => comment.id !== commentId),
            })),
          };
        },
      );
      return { previous };
    },
    onError: (_error, _commentId, context) => {
      queryClient.setQueryData(feedCommentsKey(postId, targetUserId), context?.previous);
    },
    onSuccess: ({ post }) => {
      if (post) updatePostInAllCaches(queryClient, post);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: feedThreadKey(postId, targetUserId) });
    },
  });
}

export function useFeedProfile(userId: string | null) {
  const authUserId = useAuthStore((state) => state.user?.id ?? '');
  const activeMemberId = useActiveMemberId();
  const targetUserId = activeMemberId || authUserId;

  return useInfiniteQuery({
    queryKey: feedProfileKey(userId ?? '', targetUserId),
    queryFn: ({ pageParam }) =>
      getFeedProfile({
        userId: userId!,
        targetUserId,
        cursor: pageParamToCursor(pageParam),
        limit: FEED_PAGE_SIZE,
      }),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: nextPageParam,
    enabled: Boolean(userId) && Boolean(targetUserId),
    staleTime: NOTIFICATIONS_STALE_MS,
  });
}

export function useFeedSearch(query: string, type: FeedSearchType = 'all', enabled = true) {
  const trimmed = query.trim();

  return useInfiniteQuery({
    queryKey: feedSearchKey(trimmed, type),
    queryFn: ({ pageParam }) =>
      searchFeed({
        query: trimmed,
        type,
        offset: typeof pageParam === 'number' ? pageParam : 0,
        limit: 20,
      }),
    initialPageParam: 0,
    getNextPageParam: (page) => page.nextOffset ?? undefined,
    enabled,
    staleTime: NOTIFICATIONS_STALE_MS,
  });
}

export function useToggleFeedFollow(followeeId: string) {
  const queryClient = useQueryClient();
  const authUserId = useAuthStore((state) => state.user?.id ?? '');
  const activeMemberId = useActiveMemberId();
  const targetUserId = activeMemberId || authUserId;

  return useMutation({
    mutationFn: () => toggleFeedFollow(followeeId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: feedProfileKey(followeeId, targetUserId) });

      const previousData = queryClient.getQueryData<InfiniteData<FeedProfilePage>>(
        feedProfileKey(followeeId, targetUserId)
      );

      if (previousData && previousData.pages[0]?.profile) {
        const profile = previousData.pages[0].profile;
        const willBeFollowing = !profile.isFollowing;
        const newFollowerCount = Math.max(0, profile.followerCount + (willBeFollowing ? 1 : -1));

        queryClient.setQueryData<InfiniteData<FeedProfilePage>>(
          feedProfileKey(followeeId, targetUserId),
          {
            ...previousData,
            pages: previousData.pages.map((page, index) =>
              index === 0
                ? {
                    ...page,
                    profile: {
                      ...profile,
                      isFollowing: willBeFollowing,
                      followerCount: newFollowerCount,
                    },
                  }
                : page
            ),
          }
        );
      }

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(feedProfileKey(followeeId, targetUserId), context.previousData);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: feedProfileKey(followeeId, targetUserId) });
    },
  });
}

