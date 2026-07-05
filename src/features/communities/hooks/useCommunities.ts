import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useMyCoachRecord } from '@/features/coach/hooks/useMyCoachRecord';
import {
  addCommunityGroupMembers,
  archiveCommunityGroup,
  createCommunityGroup,
  getCommunityChannelHeader,
  leaveCommunityChannel,
  listCoachGroupDisciplines,
  listCommunityGroupMembers,
  listCommunityChannelFeed,
  listCommunityChannelPosts,
  listCommunityChannels,
  listCoachCommunityChannels,
  listCoachCommunityAnnouncementChannels,
  markCommunityChannelRead,
  pinCommunityPost,
  publishCommunityPost,
  removeCommunityGroupMember,
  searchCommunityGroupMemberCandidates,
  searchCommunityMemberCandidates,
  toggleCommunityReaction,
  unpinCommunityPost,
  type ListCommunityChannelFeedInput,
} from '@/services/database/community.repository';
import type { CommunityFeedCursor, CommunityGroupMemberCandidate } from '@/types/domain';
import { useAuthStore } from '@/stores/useAuthStore';

export const communityChannelsKey = (userId: string) => ['community-channels', userId] as const;
export const discoverableCommunityChannelsKey = (userId: string) =>
  ['community-discoverable-channels', userId] as const;
export const coachCommunityChannelsKey = (userId: string, coachId: string) =>
  ['coach-community-channels', userId, coachId] as const;
export const coachCommunityAnnouncementChannelsKey = (userId: string, coachId: string) =>
  ['coach-community-announcement-channels', userId, coachId] as const;
export const coachGroupDisciplinesKey = (userId: string, coachId: string) =>
  ['coach-group-disciplines', userId, coachId] as const;
export const communityGroupMembersKey = (channelId: string) =>
  ['community-group-members', channelId] as const;
export const communityGroupMemberCandidatesKey = (channelId: string, query: string) =>
  ['community-group-member-candidates', channelId, query.trim().toLowerCase()] as const;
export const communityMemberCandidatesKey = (coachId: string, query: string) =>
  ['community-member-candidates', coachId, query.trim().toLowerCase()] as const;
export const communityPostsKey = (channelId: string) => ['community-posts', channelId] as const;
export const communityFeedKey = (channelId: string, cursor?: CommunityFeedCursor | null) =>
  ['community-feed', channelId, cursor?.publishedAt ?? 'start', cursor?.id ?? 'start'] as const;
export const communityFeedInfiniteKey = (channelId: string) => ['community-feed-infinite', channelId] as const;
export const communityHeaderKey = (channelId: string, userId = '') =>
  ['community-header', userId, channelId] as const;

export function invalidateCommunityHeaderQueries(queryClient: QueryClient, channelId: string) {
  void queryClient.invalidateQueries({
    queryKey: ['community-header'],
    predicate: (query) => query.queryKey[2] === channelId,
  });
}

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

export function useCoachCommunityAnnouncementChannels(enabled = true) {
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const { coach, isLoading: coachLoading, isError: coachError } = useMyCoachRecord();

  const query = useQuery({
    queryKey: coachCommunityAnnouncementChannelsKey(userId, coach?.id ?? 'none'),
    queryFn: () => listCoachCommunityAnnouncementChannels(coach!.id),
    enabled: enabled && Boolean(userId) && Boolean(coach),
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    isLoading: query.isLoading || coachLoading,
    isError: query.isError || coachError,
  };
}

export function useCoachGroupDisciplines(enabled = true) {
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const { coach, isLoading: coachLoading, isError: coachError } = useMyCoachRecord();

  const query = useQuery({
    queryKey: coachGroupDisciplinesKey(userId, coach?.id ?? 'none'),
    queryFn: () => listCoachGroupDisciplines(coach!.id),
    enabled: enabled && Boolean(userId) && Boolean(coach),
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    isLoading: query.isLoading || coachLoading,
    isError: query.isError || coachError,
  };
}

export function useCoachCommunityUnreadTotal(enabled = true) {
  const query = useCoachCommunityChannels(enabled);
  const unreadTotal = (query.data ?? []).reduce((sum, channel) => sum + channel.unreadCount, 0);

  return {
    ...query,
    unreadTotal,
  };
}

export function useCommunityChannelHeader(channelId: string, enabled = true) {
  const userId = useAuthStore((state) => state.user?.id ?? '');

  return useQuery({
    queryKey: communityHeaderKey(channelId, userId),
    queryFn: () => getCommunityChannelHeader(channelId),
    enabled: enabled && Boolean(channelId) && Boolean(userId),
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
    staleTime: 5 * 1000,
  });
}

export function useMarkCommunityChannelRead(channelId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');

  return useMutation({
    mutationFn: () => markCommunityChannelRead(channelId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: communityChannelsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: ['coach-community-channels', userId] }),
        queryClient.invalidateQueries({ queryKey: communityFeedInfiniteKey(channelId) }),
      ]);
    },
  });
}

export function useLeaveCommunityChannel(channelId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');

  return useMutation({
    mutationFn: () => leaveCommunityChannel(channelId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: communityChannelsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: discoverableCommunityChannelsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: communityFeedInfiniteKey(channelId) }),
        invalidateCommunityHeaderQueries(queryClient, channelId),
      ]);
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

export function useToggleCommunityReaction(postId: string, channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emoji: string) => toggleCommunityReaction(postId, emoji),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: communityPostsKey(channelId) });
      void queryClient.invalidateQueries({ queryKey: communityFeedKey(channelId) });
      void queryClient.invalidateQueries({ queryKey: communityFeedInfiniteKey(channelId) });
      invalidateCommunityHeaderQueries(queryClient, channelId);
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
        Promise.resolve(invalidateCommunityHeaderQueries(queryClient, channelId)),
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
        Promise.resolve(invalidateCommunityHeaderQueries(queryClient, channelId)),
        queryClient.invalidateQueries({ queryKey: communityPostsKey(channelId) }),
      ]);
    },
  });
}

export function usePublishCommunityPost(coachId?: string) {
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
        invalidateCommunityHeaderQueries(queryClient, variables.channelId),
        queryClient.invalidateQueries({ queryKey: communityChannelsKey(userId) }),
        queryClient.invalidateQueries({
          queryKey: coachCommunityChannelsKey(userId, coachId ?? 'none'),
        }),
        queryClient.invalidateQueries({
          queryKey: coachCommunityAnnouncementChannelsKey(userId, coachId ?? 'none'),
        }),
      ]);
    },
  });
}

export function useCreateCommunityGroup(coachId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');

  return useMutation({
    mutationFn: (input: {
      disciplineId: string;
      title: string;
      description?: string | null;
      memberIds?: string[];
    }) => createCommunityGroup({ ...input, coachId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: coachCommunityChannelsKey(userId, coachId) }),
        queryClient.invalidateQueries({ queryKey: communityChannelsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: discoverableCommunityChannelsKey(userId) }),
      ]);
    },
  });
}

export function useArchiveCommunityGroup(coachId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');

  return useMutation({
    mutationFn: (channelId: string) => archiveCommunityGroup({ channelId, coachId }),
    onSuccess: async (_result, channelId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: coachCommunityChannelsKey(userId, coachId) }),
        queryClient.invalidateQueries({ queryKey: communityChannelsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: discoverableCommunityChannelsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: communityFeedInfiniteKey(channelId) }),
      ]);
    },
  });
}

export function useCommunityGroupMembers(
  channelId: string,
  coachId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: communityGroupMembersKey(channelId),
    queryFn: () => listCommunityGroupMembers(channelId, coachId),
    enabled: enabled && Boolean(channelId) && Boolean(coachId),
    staleTime: 30 * 1000,
  });
}

export function useCommunityGroupMemberCandidates(
  channelId: string,
  coachId: string,
  query: string,
  enabled = true,
) {
  return useQuery({
    queryKey: communityGroupMemberCandidatesKey(channelId, query),
    queryFn: () => searchCommunityGroupMemberCandidates({ channelId, coachId, query }),
    enabled: enabled && Boolean(channelId) && Boolean(coachId),
    staleTime: 15 * 1000,
  });
}

export function useCommunityMemberCandidates(
  coachId: string,
  query: string,
  enabled = true,
) {
  return useQuery({
    queryKey: communityMemberCandidatesKey(coachId, query),
    queryFn: () => searchCommunityMemberCandidates({ coachId, query }),
    enabled: enabled && Boolean(coachId),
    staleTime: 15 * 1000,
  });
}

export function useAddCommunityGroupMembers(channelId: string, coachId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');

  return useMutation({
    mutationFn: (members: CommunityGroupMemberCandidate[]) =>
      addCommunityGroupMembers({
        channelId,
        coachId,
        memberIds: members.map((member) => member.id),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: communityGroupMembersKey(channelId) }),
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === 'community-group-member-candidates' &&
            query.queryKey[1] === channelId,
        }),
        queryClient.invalidateQueries({ queryKey: coachCommunityChannelsKey(userId, coachId) }),
        invalidateCommunityHeaderQueries(queryClient, channelId),
      ]);
    },
  });
}

export function useRemoveCommunityGroupMember(channelId: string, coachId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');

  return useMutation({
    mutationFn: (memberId: string) => removeCommunityGroupMember({ channelId, coachId, memberId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: communityGroupMembersKey(channelId) }),
        queryClient.invalidateQueries({ queryKey: coachCommunityChannelsKey(userId, coachId) }),
        invalidateCommunityHeaderQueries(queryClient, channelId),
      ]);
    },
  });
}
