import React from 'react';
import { StyleSheet } from 'react-native';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import { CommunityAnnouncementComposer } from '@/features/communities/components/CommunityAnnouncementComposer';
import { AppBar } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';

export default function CoachPostAnnouncementScreen() {
  const { colors } = useTheme();

  return (
    <AppSafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar title="Post announcement" showBackButton fallbackHref="/(coach)/communities" />
      <CommunityAnnouncementComposer />
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
