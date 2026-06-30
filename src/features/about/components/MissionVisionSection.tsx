import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MISSION_BLOCKS } from '@/features/about/content/academyContent';
import { AboutContentCard } from '@/features/about/components/AboutContentCard';
import { AboutSectionHeader } from '@/features/about/components/AboutSectionHeader';
import { RevealOnMount } from '@/shared/animations';
import { useTheme } from '@/shared/theme';

function MissionCard({
  index,
  title,
  body,
  tagline,
}: {
  index: number;
  title: string;
  body: string;
  tagline?: string;
}) {
  const { colors, gap } = useTheme();

  return (
    <AboutContentCard style={{ gap: gap.sm }}>
      <Text style={[styles.index, { color: index === 1 ? colors.brand.red : colors.accent.default }]}>
        {String(index + 1).padStart(2, '0')}
      </Text>
      <Text style={[styles.cardTitle, { color: colors.text.primary }]}>{title}</Text>
      <Text style={[styles.cardBody, { color: colors.text.secondary }]}>{body}</Text>
      {tagline ? (
        <Text style={[styles.tagline, { color: colors.text.secondary }]}>{tagline}</Text>
      ) : null}
    </AboutContentCard>
  );
}

export function MissionVisionSection() {
  const { gap } = useTheme();

  return (
    <RevealOnMount delay={120} style={{ gap: gap.md }}>
      <AboutSectionHeader kicker="WHAT DRIVES US" title="Mission, Goal & Vision" />
      <View style={{ gap: gap.sm }}>
        {MISSION_BLOCKS.map((block, index) => (
          <MissionCard
            key={block.title}
            index={index}
            title={block.title}
            body={block.body}
            tagline={'tagline' in block ? block.tagline : undefined}
          />
        ))}
      </View>
    </RevealOnMount>
  );
}

const styles = StyleSheet.create({
  index: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  cardBody: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  tagline: {
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '500',
    lineHeight: 20,
  },
});
