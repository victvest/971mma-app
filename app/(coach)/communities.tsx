import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import {
  CommunityGroupsFab,
  CommunityInboxScreen,
  CommunityUnreadChip,
} from '@/features/communities/components';
import {
  useCoachCommunityChannels,
  useCoachCommunityUnreadTotal,
} from '@/features/communities/hooks/useCommunities';
import { canUseCoachCommunityTools } from '@/features/communities/utils/communityPermissions';
import { useCommunityInboxRealtime } from '@/features/communities/hooks/useCommunityRealtime';
import { AppBar } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';
import { useAuthStore } from '@/stores/useAuthStore';

export default function CoachCommunitiesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const channelsQuery = useCoachCommunityChannels();
  const { unreadTotal } = useCoachCommunityUnreadTotal();
  const channels = channelsQuery.data ?? [];
  const channelIds = useMemo(() => channels.map((channel) => channel.id), [channels]);
  const hasGroups = channels.length > 0;
  const canManageGroups = canUseCoachCommunityTools(role);

  useCommunityInboxRealtime(channelIds, !channelsQuery.isLoading && hasGroups);

  const openCreateWizard = () => router.push('/(coach)/community-groups/new');

  return (
    <AppSafeAreaView
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
          title="Coach groups."
          subtitle="Create public groups members can discover, or private groups for selected members."
          emptyTitle="No groups yet"
          emptyMessage="Create your first group once your coach profile is linked to a discipline."
          emptyActionLabel={canManageGroups ? 'Create group' : undefined}
          onEmptyAction={canManageGroups ? openCreateWizard : undefined}
        />
        {canManageGroups ? (
          <CommunityGroupsFab
            icon="add"
            accessibilityLabel="Create group"
            onPress={openCreateWizard}
          />
        ) : null}
      </View>
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: {
    flex: 1,
  },
});
