import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CommunityAnnouncementSheet,
  CommunityGroupsFab,
  CommunityInboxScreen,
  CommunityUnreadChip,
} from '@/features/communities/components';
import {
  useCoachCommunityChannels,
  useCoachCommunityUnreadTotal,
} from '@/features/communities/hooks/useCommunities';
import { useCommunityInboxRealtime } from '@/features/communities/hooks/useCommunityRealtime';
import { AppBar } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';

export default function CoachCommunitiesScreen() {
  const { colors } = useTheme();
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const channelsQuery = useCoachCommunityChannels();
  const { unreadTotal } = useCoachCommunityUnreadTotal();
  const channels = channelsQuery.data ?? [];
  const channelIds = useMemo(() => channels.map((channel) => channel.id), [channels]);
  const hasGroups = channels.length > 0;

  useCommunityInboxRealtime(channelIds, !channelsQuery.isLoading && hasGroups);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar
        title="My groups"
        showBackButton
        rightElement={<CommunityUnreadChip count={unreadTotal} size="md" />}
      />
      <View style={styles.body}>
        <CommunityInboxScreen
          channels={channels}
          isLoading={channelsQuery.isLoading}
          isError={channelsQuery.isError}
          onRefresh={() => channelsQuery.refetch()}
          onRetry={() => channelsQuery.refetch()}
          unreadTotal={unreadTotal}
          eyebrow="971 MMA · Coach"
          title="Your groups."
          subtitle="Post announcements and chat with your members."
          emptyTitle="No groups yet"
          emptyMessage="Academy staff must link your coach profile to at least one discipline."
        />
        {hasGroups ? (
          <CommunityGroupsFab onPress={() => setAnnouncementOpen(true)} />
        ) : null}
      </View>
      <CommunityAnnouncementSheet
        visible={announcementOpen}
        onDismiss={() => setAnnouncementOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: {
    flex: 1,
  },
});
