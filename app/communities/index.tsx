import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommunityInboxScreen } from '@/features/communities/components/CommunityInboxScreen';
import { useCommunityChannels } from '@/features/communities/hooks/useCommunities';
import { AppBar } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';

export default function CommunitiesScreen() {
  const { colors } = useTheme();
  const channelsQuery = useCommunityChannels();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar title="Communities" showBackButton />
      <CommunityInboxScreen
        channels={channelsQuery.data ?? []}
        isLoading={channelsQuery.isLoading}
        isError={channelsQuery.isError}
        onRefresh={() => channelsQuery.refetch()}
        onRetry={() => channelsQuery.refetch()}
        eyebrow="971 MMA · Community"
        title="Your groups."
        subtitle="Groups for your enrolled disciplines."
        emptyTitle="No groups yet"
        emptyMessage="Groups appear when you are enrolled in a discipline, checked into a class, or linked by academy staff. Pull to refresh after your next visit."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
