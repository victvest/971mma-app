import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AboutSectionHeader } from '@/features/about/components/AboutSectionHeader';
import { useTheme } from '@/shared/theme';

export function LineageHero() {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.hero}>
      <AboutSectionHeader kicker="LINEAGE" />
      <Text style={[typography.textPresets.homeHero, { color: colors.text.primary }]}>
        Know your <Text style={{ color: colors.accent.default }}>past.</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 6,
    marginBottom: 20,
  },
});
