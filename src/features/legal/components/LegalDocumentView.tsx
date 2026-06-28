import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppScrollView } from '@/shared/components/ui';
import { AcademyEyebrow } from '@/shared/components/brand';
import { RevealOnMount } from '@/shared/animations';
import { useTheme } from '@/shared/theme';
import type { LegalDocument } from '@/features/legal/data/legalContent';

type Props = {
  document: LegalDocument;
};

export function LegalDocumentView({ document }: Props) {
  const { colors, typography, inset, gap } = useTheme();

  return (
    <AppScrollView
      style={styles.flex}
      contentContainerStyle={{
        paddingHorizontal: inset.lg,
        paddingTop: inset.sm,
        paddingBottom: inset['2xl'],
        gap: gap.xl,
      }}
      showsVerticalScrollIndicator={false}
    >
      <RevealOnMount delay={0}>
        <AcademyEyebrow label={document.eyebrow} accent />
        <Text style={[typography.textPresets.title, { color: colors.text.primary, marginTop: gap.xs }]}>
          {document.title}
        </Text>
        <Text style={[typography.textPresets.caption, { color: colors.text.tertiary, marginTop: gap.xs }]}>
          Last updated · {document.lastUpdated}
        </Text>
        <Text style={[typography.textPresets.body, { color: colors.text.secondary, marginTop: gap.md }]}>
          {document.intro}
        </Text>
      </RevealOnMount>

      {document.sections.map((section, index) => (
        <RevealOnMount key={section.heading} delay={80 + index * 50} style={{ gap: gap.xs }}>
          <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
            {section.heading}
          </Text>
          <View style={{ gap: gap.sm }}>
            {section.paragraphs.map((paragraph, pIndex) => (
              <Text
                key={pIndex}
                style={[typography.textPresets.body, { color: colors.text.secondary }]}
              >
                {paragraph}
              </Text>
            ))}
          </View>
        </RevealOnMount>
      ))}
    </AppScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
