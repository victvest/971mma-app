import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getSupabaseClient } from '@/services/supabase/client';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  communityChannelsKey,
  discoverableCommunityChannelsKey,
  communityFeedInfiniteKey,
  invalidateCommunityHeaderQueries,
} from './useCommunities';

export function useCommunityChannelRealtime(channelId: string, enabled = true) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');

  useEffect(() => {
    if (!enabled || !channelId || !userId) return undefined;

    const supabase = getSupabaseClient();
    const topic = `community-channel:${channelId}`;

    const invalidateFeed = () => {
      void queryClient.invalidateQueries({ queryKey: communityFeedInfiniteKey(channelId) });
      invalidateCommunityHeaderQueries(queryClient, channelId);
      void queryClient.invalidateQueries({ queryKey: communityChannelsKey(userId) });
      void queryClient.invalidateQueries({ queryKey: discoverableCommunityChannelsKey(userId) });
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
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelId, enabled, queryClient, userId]);
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
            void queryClient.invalidateQueries({ queryKey: discoverableCommunityChannelsKey(userId) });
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
