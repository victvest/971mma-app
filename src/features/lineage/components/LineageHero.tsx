import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/theme';

export function LineageHero() {
  const { colors } = useTheme();

  return (
    <View style={styles.hero}>
      <Text style={[styles.kicker, { color: colors.text.tertiary }]}>LINEAGE</Text>
      <Text style={[styles.title, { color: colors.text.primary }]}>
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
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 42,
  },
});
