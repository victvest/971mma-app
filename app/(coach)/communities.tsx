import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommunityInboxScreen } from '@/features/communities/components/CommunityInboxScreen';
import { useCoachCommunityChannels } from '@/features/communities/hooks/useCommunities';
import { AppBar } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';

export default function CoachCommunitiesScreen() {
  const { colors } = useTheme();
  const channelsQuery = useCoachCommunityChannels();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar title="My groups" showBackButton />
      <CommunityInboxScreen
        channels={channelsQuery.data ?? []}
        isLoading={channelsQuery.isLoading}
        isError={channelsQuery.isError}
        onRefresh={() => channelsQuery.refetch()}
        onRetry={() => channelsQuery.refetch()}
        eyebrow="971 MMA · Coach"
        title="Your groups."
        subtitle="Open a group to chat with your members."
        emptyTitle="No groups yet"
        emptyMessage="Academy staff must link your coach profile to at least one discipline."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
