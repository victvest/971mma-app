import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useMyCoachRecord } from '@/features/coach/hooks/useMyCoachRecord';
import {
  createCommunityReply,
  getCommunityChannelHeader,
  getCommunityPostThread,
  listCommunityChannelFeed,
  listCommunityChannelPosts,
  listCommunityChannels,
  listCoachCommunityChannels,
  markCommunityChannelRead,
  pinCommunityPost,
  publishCommunityPost,
  toggleCommunityReaction,
  unpinCommunityPost,
  type ListCommunityChannelFeedInput,
} from '@/services/database/community.repository';
import type { CommunityFeedCursor } from '@/types/domain';
import { useAuthStore } from '@/stores/useAuthStore';

export const communityChannelsKey = (userId: string) => ['community-channels', userId] as const;
export const coachCommunityChannelsKey = (userId: string, coachId: string) =>
  ['coach-community-channels', userId, coachId] as const;
export const communityPostsKey = (channelId: string) => ['community-posts', channelId] as const;
export const communityFeedKey = (channelId: string, cursor?: CommunityFeedCursor | null) =>
  ['community-feed', channelId, cursor?.publishedAt ?? 'start', cursor?.id ?? 'start'] as const;
export const communityFeedInfiniteKey = (channelId: string) => ['community-feed-infinite', channelId] as const;
export const communityHeaderKey = (channelId: string) => ['community-header', channelId] as const;
export const communityThreadKey = (postId: string) => ['community-thread', postId] as const;

export function useCommunityChannels(enabled = true) {
  const userId = useAuthStore((state) => state.user?.id ?? '');

  return useQuery({
    queryKey: communityChannelsKey(userId),
    queryFn: listCommunityChannels,
    enabled: enabled && Boolean(userId),
    staleTime: 60 * 1000,
  });
}

export function useCommunityUnreadTotal(enabled = true) {
  const query = useCommunityChannels(enabled);

  const unreadTotal = (query.data ?? []).reduce((sum, channel) => sum + channel.unreadCount, 0);

  return {
    ...query,
    unreadTotal,
  };
}

export function useCoachCommunityChannels(enabled = true) {
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const { coach, isLoading: coachLoading, isError: coachError } = useMyCoachRecord();

  const query = useQuery({
    queryKey: coachCommunityChannelsKey(userId, coach?.id ?? 'none'),
    queryFn: () => listCoachCommunityChannels(coach!.id),
    enabled: enabled && Boolean(userId) && Boolean(coach),
    staleTime: 60 * 1000,
  });

  return {
    ...query,
    isLoading: query.isLoading || coachLoading,
    isError: query.isError || coachError,
  };
}

export function useCommunityChannelHeader(channelId: string, enabled = true) {
  return useQuery({
    queryKey: communityHeaderKey(channelId),
    queryFn: () => getCommunityChannelHeader(channelId),
    enabled: enabled && Boolean(channelId),
    staleTime: 30 * 1000,
  });
}

export function useCommunityChannelFeed(input: ListCommunityChannelFeedInput, enabled = true) {
  return useQuery({
    queryKey: communityFeedKey(input.channelId, input.cursor),
    queryFn: () => listCommunityChannelFeed(input),
    enabled: enabled && Boolean(input.channelId),
    staleTime: 30 * 1000,
  });
}

export function useCommunityChannelFeedInfinite(channelId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: communityFeedInfiniteKey(channelId),
    queryFn: ({ pageParam }) =>
      listCommunityChannelFeed({
        channelId,
        limit: 25,
        cursor: pageParam,
      }),
    initialPageParam: null as CommunityFeedCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: enabled && Boolean(channelId),
    staleTime: 30 * 1000,
  });
}

export function useMarkCommunityChannelRead(channelId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');

  return useMutation({
    mutationFn: () => markCommunityChannelRead(channelId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: communityChannelsKey(userId) });
    },
  });
}

export function useMarkCommunityChannelReadOnFocus(channelId: string, enabled = true) {
  const { mutate } = useMarkCommunityChannelRead(channelId);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !channelId) return undefined;

      const timer = setTimeout(() => {
        mutate();
      }, 300);

      return () => clearTimeout(timer);
    }, [channelId, enabled, mutate]),
  );
}

export function useCommunityChannelPosts(channelId: string, enabled = true) {
  return useQuery({
    queryKey: communityPostsKey(channelId),
    queryFn: () => listCommunityChannelPosts(channelId),
    enabled: enabled && Boolean(channelId),
    staleTime: 30 * 1000,
  });
}

export function useCommunityPostThread(postId: string, enabled = true) {
  return useQuery({
    queryKey: communityThreadKey(postId),
    queryFn: () => getCommunityPostThread(postId),
    enabled: enabled && Boolean(postId),
    staleTime: 15 * 1000,
  });
}

export function useToggleCommunityReaction(postId: string, channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emoji: string) => toggleCommunityReaction(postId, emoji),
    onSuccess: (thread) => {
      queryClient.setQueryData(communityThreadKey(postId), thread);
      void queryClient.invalidateQueries({ queryKey: communityPostsKey(channelId) });
      void queryClient.invalidateQueries({ queryKey: communityFeedKey(channelId) });
      void queryClient.invalidateQueries({ queryKey: communityFeedInfiniteKey(channelId) });
      void queryClient.invalidateQueries({ queryKey: communityHeaderKey(channelId) });
    },
  });
}

export function useCreateCommunityReply(postId: string, channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => createCommunityReply(postId, body),
    onSuccess: (thread) => {
      queryClient.setQueryData(communityThreadKey(postId), thread);
      void queryClient.invalidateQueries({ queryKey: communityPostsKey(channelId) });
      void queryClient.invalidateQueries({ queryKey: communityFeedKey(channelId) });
      void queryClient.invalidateQueries({ queryKey: communityFeedInfiniteKey(channelId) });
    },
  });
}

export function usePinCommunityPost(channelId: string, coachId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => pinCommunityPost(postId, coachId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: communityFeedKey(channelId) }),
        queryClient.invalidateQueries({ queryKey: communityFeedInfiniteKey(channelId) }),
        queryClient.invalidateQueries({ queryKey: communityHeaderKey(channelId) }),
        queryClient.invalidateQueries({ queryKey: communityPostsKey(channelId) }),
      ]);
    },
  });
}

export function useUnpinCommunityPost(channelId: string, coachId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => unpinCommunityPost(postId, coachId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: communityFeedKey(channelId) }),
        queryClient.invalidateQueries({ queryKey: communityFeedInfiniteKey(channelId) }),
        queryClient.invalidateQueries({ queryKey: communityHeaderKey(channelId) }),
        queryClient.invalidateQueries({ queryKey: communityPostsKey(channelId) }),
      ]);
    },
  });
}

export function usePublishCommunityPost(coachId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');

  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof publishCommunityPost>[0], 'coachId'>) =>
      publishCommunityPost({ ...input, coachId }),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: communityPostsKey(variables.channelId) }),
        queryClient.invalidateQueries({ queryKey: communityFeedKey(variables.channelId) }),
        queryClient.invalidateQueries({ queryKey: communityFeedInfiniteKey(variables.channelId) }),
        queryClient.invalidateQueries({ queryKey: communityHeaderKey(variables.channelId) }),
        queryClient.invalidateQueries({ queryKey: communityChannelsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: coachCommunityChannelsKey(userId, coachId) }),
      ]);
    },
  });
}
