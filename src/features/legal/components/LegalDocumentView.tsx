import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppScrollView, Card, ScreenSectionHeader } from '@/shared/components/ui';
import { RevealOnMount } from '@/shared/animations';
import { useTheme } from '@/shared/theme';
import type { LegalDocument } from '@/features/legal/data/legalContent';

function LegalSectionHeading({ heading }: { heading: string }) {
  const { colors, typography } = useTheme();
  const match = heading.match(/^(\d+\.)\s*(.+)$/);

  if (!match) {
    return (
      <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
        {heading}
      </Text>
    );
  }

  return (
    <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
      <Text style={{ color: colors.brand.red }}>{match[1]} </Text>
      {match[2]}
    </Text>
  );
}

type Props = {
  document: LegalDocument;
};

export function LegalDocumentView({ document }: Props) {
  const { colors, typography, inset, gap, radius } = useTheme();

  return (
    <AppScrollView
      style={styles.flex}
      contentContainerStyle={{
        paddingHorizontal: inset.lg,
        paddingBottom: inset['2xl'],
        gap: gap.md,
      }}
      showsVerticalScrollIndicator={false}
    >
      <RevealOnMount delay={0}>
        <ScreenSectionHeader kicker={document.eyebrow} />
        <Text style={[typography.textPresets.homeHero, { color: colors.text.primary, marginTop: gap.xs }]}>
          {document.title}
        </Text>
        <Text
          style={[typography.textPresets.caption, { color: colors.text.tertiary, marginTop: gap.xs }]}
        >
          Last updated · {document.lastUpdated}
        </Text>
      </RevealOnMount>

      <RevealOnMount delay={40}>
        <Card
          padded={false}
          style={{
            borderRadius: radius.cardLarge,
            padding: inset.lg,
          }}
        >
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
            {document.intro}
          </Text>
        </Card>
      </RevealOnMount>

      {document.sections.map((section, index) => (
        <RevealOnMount key={section.heading} delay={80 + index * 40}>
          <Card
            padded={false}
            style={{
              borderRadius: radius.cardLarge,
              padding: inset.lg,
              gap: gap.sm,
            }}
          >
            <LegalSectionHeading heading={section.heading} />
            <View style={{ gap: gap.sm }}>
              {section.paragraphs.map((paragraph, pIndex) => (
                <Text
                  key={pIndex}
                  style={[typography.textPresets.body, styles.body, { color: colors.text.secondary }]}
                >
                  {paragraph}
                </Text>
              ))}
            </View>
          </Card>
        </RevealOnMount>
      ))}
    </AppScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    lineHeight: 22,
  },
});
