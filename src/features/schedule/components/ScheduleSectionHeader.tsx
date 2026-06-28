import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AcademyEyebrow, TabHeroTitle } from '@/shared/components/brand';

export function ScheduleSectionHeader() {
  return (
    <View style={styles.container}>
      <AcademyEyebrow label="Schedule" accent showFlag={false} />
      <TabHeroTitle
        lines={[
          [{ text: 'Today' }],
          [{ text: 'on the mat.', accent: true }],
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginBottom: 4,
  },
});
