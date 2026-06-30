import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { CommunityAnnouncementComposer } from '@/features/communities/components/CommunityAnnouncementComposer';
import { AppBar } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';

export default function CoachPostAnnouncementScreen() {
  const { colors } = useTheme();
  const { channelId } = useLocalSearchParams<{ channelId?: string }>();
  const initialChannelId = typeof channelId === 'string' ? channelId : undefined;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar title="Post announcement" showBackButton />
      <CommunityAnnouncementComposer
        initialChannelId={initialChannelId}
        lockChannel={Boolean(initialChannelId)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
