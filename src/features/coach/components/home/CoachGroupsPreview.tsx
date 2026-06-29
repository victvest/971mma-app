import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CommunityInboxRow } from '@/features/communities/components/CommunityInboxRow';
import { useCoachCommunityChannels } from '@/features/communities/hooks/useCommunities';
import { HomeSectionTitle } from '@/features/home/components/HomeSectionTitle';
import { StateBlock } from '@/shared/components/StateBlock';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

export function CoachGroupsPreview() {
  const { colors, typography, inset, gap, radius } = useTheme();
  const router = useRouter();
  const channelsQuery = useCoachCommunityChannels();
  const channels = channelsQuery.data ?? [];

  const openGroups = useCallback(() => {
    triggerLightImpact();
    router.push('/(coach)/communities');
  }, [router]);

  if (channelsQuery.isLoading) {
    return null;
  }

  return (
    <View style={{ gap: gap.md }}>
      <HomeSectionTitle
        title="My groups"
        actionLabel="See all →"
        onAction={openGroups}
        actionAccessibilityLabel="See all groups"
      />

      {channelsQuery.isError ? (
        <StateBlock
          kind="error"
          title="Could not load groups"
          message="Pull to refresh or open groups from the menu."
          actionLabel="Retry"
          onAction={() => channelsQuery.refetch()}
        />
      ) : channels.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: colors.surface.secondary,
              borderColor: colors.border.subtle,
              borderRadius: radius.card,
              padding: inset.lg,
            },
          ]}
        >
          <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
            Groups appear here once your coach profile is linked to a discipline.
          </Text>
        </View>
      ) : (
        <View style={{ gap: gap.xs }}>
          {channels.slice(0, 3).map((channel) => (
            <CommunityInboxRow
              key={channel.id}
              channel={channel}
              onPress={() => router.push(`/communities/${channel.id}`)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
