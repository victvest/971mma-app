import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import { CommunityInboxScreen, CommunityUnreadChip } from '@/features/communities/components';
import { useCommunityChannels, useCommunityUnreadTotal } from '@/features/communities/hooks/useCommunities';
import { useCommunityInboxRealtime } from '@/features/communities/hooks/useCommunityRealtime';
import { AppBar } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';

export default function CommunitiesScreen() {
  const { colors } = useTheme();
  const channelsQuery = useCommunityChannels();
  const { unreadTotal } = useCommunityUnreadTotal();
  const channels = channelsQuery.data ?? [];
  const channelIds = useMemo(() => channels.map((channel) => channel.id), [channels]);

  useCommunityInboxRealtime(channelIds, !channelsQuery.isLoading && channels.length > 0);

  return (
    <AppSafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar
        title="Communities"
        showBackButton
        rightElement={<CommunityUnreadChip count={unreadTotal} size="md" />}
      />
      <CommunityInboxScreen
        channels={channels}
        isLoading={channelsQuery.isLoading}
        isError={channelsQuery.isError}
        onRefresh={() => channelsQuery.refetch()}
        onRetry={() => channelsQuery.refetch()}
        unreadTotal={unreadTotal}
        eyebrow="971 MMA · Community"
        title="Your communities."
        subtitle="Community announcements plus group chats you've been added to."
        emptyTitle="No groups yet"
        emptyMessage="Groups appear here once your coach adds you to one."
      />
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
