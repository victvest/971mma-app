import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getSupabaseClient } from '@/services/supabase/client';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  communityChannelsKey,
  communityFeedInfiniteKey,
  communityHeaderKey,
  communityThreadKey,
} from './useCommunities';

type RealtimePayload = {
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

function readPostId(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  const value = row.post_id ?? row.postId ?? row.id;
  return typeof value === 'string' && value.trim() ? value : null;
}

export function useCommunityChannelRealtime(channelId: string, enabled = true) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');

  useEffect(() => {
    if (!enabled || !channelId || !userId) return undefined;

    const supabase = getSupabaseClient();
    const topic = `community-channel:${channelId}`;

    const invalidateFeed = () => {
      void queryClient.invalidateQueries({ queryKey: communityFeedInfiniteKey(channelId) });
      void queryClient.invalidateQueries({ queryKey: communityHeaderKey(channelId) });
      void queryClient.invalidateQueries({ queryKey: communityChannelsKey(userId) });
      void queryClient.invalidateQueries({ predicate: (query) => 
        Array.isArray(query.queryKey) && 
        query.queryKey[0] === 'coach-community-channels' && 
        query.queryKey[1] === userId 
      });
    };

    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_posts',
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          invalidateFeed();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'community_posts',
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          invalidateFeed();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_replies',
        },
        (payload: RealtimePayload) => {
          const postId = readPostId(payload.new);
          if (!postId) return;
          void queryClient.invalidateQueries({ queryKey: communityThreadKey(postId) });
          invalidateFeed();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelId, enabled, queryClient, userId]);
}

export function useCommunityThreadRealtime(postId: string, channelId: string, enabled = true) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');

  useEffect(() => {
    if (!enabled || !postId || !userId) return undefined;

    const supabase = getSupabaseClient();
    const topic = `community-thread:${postId}`;

    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_replies',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: communityThreadKey(postId) });
          if (channelId) {
            void queryClient.invalidateQueries({ queryKey: communityFeedInfiniteKey(channelId) });
          }
          void queryClient.invalidateQueries({ queryKey: communityChannelsKey(userId) });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelId, enabled, postId, queryClient, userId]);
}

export function useCommunityInboxRealtime(channelIds: string[], enabled = true) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');

  useEffect(() => {
    if (!enabled || !userId || channelIds.length === 0) return undefined;

    const supabase = getSupabaseClient();
    const subscriptions = channelIds.map((channelId) =>
      supabase
        .channel(`community-inbox:${channelId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'community_posts',
            filter: `channel_id=eq.${channelId}`,
          },
          () => {
            void queryClient.invalidateQueries({ queryKey: communityChannelsKey(userId) });
            void queryClient.invalidateQueries({ predicate: (query) => 
        Array.isArray(query.queryKey) && 
        query.queryKey[0] === 'coach-community-channels' && 
        query.queryKey[1] === userId 
      });
          },
        )
        .subscribe(),
    );

    return () => {
      subscriptions.forEach((subscription) => {
        void supabase.removeChannel(subscription);
      });
    };
  }, [channelIds, enabled, queryClient, userId]);
}
