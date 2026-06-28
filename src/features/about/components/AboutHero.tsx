import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { ABOUT_INTRO } from '@/features/about/content/academyContent';
import { AboutContentCard } from '@/features/about/components/AboutContentCard';
import { AboutSectionHeader } from '@/features/about/components/AboutSectionHeader';
import { RevealOnMount } from '@/shared/animations';
import { useTheme } from '@/shared/theme';

export function AboutHero() {
  const { colors, gap } = useTheme();

  return (
    <RevealOnMount style={{ gap: gap.md }}>
      <AboutSectionHeader kicker="ABOUT US" />
      <Text style={[styles.title, { color: colors.text.primary }]}>
        Earn Your <Text style={{ color: colors.accent.default }}>Level.</Text>
      </Text>
      <AboutContentCard>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{ABOUT_INTRO}</Text>
      </AboutContentCard>
    </RevealOnMount>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
});
