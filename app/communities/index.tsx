import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    <SafeAreaView
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
        title="Your groups."
        subtitle="Coach updates and member discussions for your enrolled disciplines."
        emptyTitle="No groups yet"
        emptyMessage="Groups appear when you are enrolled in a discipline, attend a class, or academy staff links your membership. Pull to refresh after your next visit."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
