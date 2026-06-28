import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { OUR_STORY, OUR_STORY_AIM } from '@/features/about/content/academyContent';
import { AboutContentCard } from '@/features/about/components/AboutContentCard';
import { AboutSectionHeader } from '@/features/about/components/AboutSectionHeader';
import { RevealOnMount } from '@/shared/animations';
import { useTheme } from '@/shared/theme';

export function MissionSection() {
  const { colors, gap } = useTheme();

  return (
    <RevealOnMount delay={100} style={{ gap: gap.md }}>
      <AboutSectionHeader kicker="OUR STORY" />
      <AboutContentCard style={{ gap: gap.sm }}>
        <Text style={[styles.story, { color: colors.text.secondary }]}>{OUR_STORY}</Text>
        <Text style={[styles.story, { color: colors.text.secondary }]}>{OUR_STORY_AIM}</Text>
      </AboutContentCard>
    </RevealOnMount>
  );
}

const styles = StyleSheet.create({
  story: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
});
