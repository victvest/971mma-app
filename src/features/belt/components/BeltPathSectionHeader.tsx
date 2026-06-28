import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AcademyEyebrow, TabHeroTitle } from '@/shared/components/brand';
import { useTheme } from '@/shared/theme';

export function BeltPathSectionHeader() {
  const { gap } = useTheme();

  return (
    <View style={[styles.container, { gap: gap.sm }]}>
      <AcademyEyebrow label="Belt path" accent showFlag={false} />
      <TabHeroTitle
        collapseOnWide
        lines={[
          [{ text: 'Earn your ' }],
          [{ text: 'level.', accent: true }],
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
