import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AcademyEyebrow, TabHeroTitle } from '@/shared/components/brand';
import { useTheme } from '@/shared/theme';

export function CheckInSectionHeader() {
  const { gap } = useTheme();

  return (
    <View style={[styles.container, { gap: gap.sm }]}>
      <AcademyEyebrow label="Member Card" accent showFlag={false} />
      <TabHeroTitle
        collapseOnWide
        lines={[
          [{ text: 'Your card.' }],
          [{ text: 'Your identity.', accent: true }],
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
