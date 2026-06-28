import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AcademyEyebrow, TabHeroTitle } from '@/shared/components/brand';
import { useTheme } from '@/shared/theme';

export function NotificationsSectionHeader() {
  const { gap } = useTheme();

  return (
    <View style={[styles.container, { gap: gap.sm }]}>
      <AcademyEyebrow label="Notifications" accent showFlag={false} />
      <TabHeroTitle
        collapseOnWide
        lines={[
          [{ text: 'Stay in the ' }],
          [{ text: 'loop.', accent: true }],
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 8,
  },
});
