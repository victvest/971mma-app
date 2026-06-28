import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { academyAssets } from '@/features/academy/assets';
import {
  PHILOSOPHY_ATTRIBUTION,
  PHILOSOPHY_BODY,
  PHILOSOPHY_BODY_EMPHASIS,
  PHILOSOPHY_QUOTE,
  PHILOSOPHY_REITERATION,
} from '@/features/about/content/academyContent';
import { AboutSectionHeader } from '@/features/about/components/AboutSectionHeader';
import { MediaBackground } from '@/shared/components/MediaBackground';
import { RevealOnMount } from '@/shared/animations';
import { useTheme } from '@/shared/theme';

export function PhilosophySection() {
  const { colors, inset, radius, gap } = useTheme();

  return (
    <RevealOnMount delay={80} style={{ gap: gap.md }}>
      <AboutSectionHeader kicker="OUR PHILOSOPHY" />

      <MediaBackground
        source={academyAssets.academyMasterart}
        style={[styles.heroImage, { borderRadius: radius.cardLarge }]}
        borderRadius={radius.cardLarge}
      >
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.media.scrimMiddle, opacity: 0.45 }]}
        />
        <View style={[styles.quoteWrap, { padding: inset.lg }]}>
          <Text style={styles.quoteMark}>“</Text>
          <Text style={styles.quote}>{PHILOSOPHY_QUOTE}</Text>
          <Text style={[styles.attribution, { color: colors.accent.default }]}>
            {PHILOSOPHY_ATTRIBUTION}
          </Text>
          <Text style={styles.reiteration}>{PHILOSOPHY_REITERATION}</Text>
        </View>
      </MediaBackground>

      <Text style={[styles.body, { color: colors.text.secondary }]}>
        {PHILOSOPHY_BODY}
        <Text style={{ color: colors.text.primary, fontWeight: '800' }}>{PHILOSOPHY_BODY_EMPHASIS}</Text>
      </Text>
    </RevealOnMount>
  );
}

const styles = StyleSheet.create({
  heroImage: {
    minHeight: 260,
    overflow: 'hidden',
  },
  quoteWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 260,
    zIndex: 1,
  },
  quoteMark: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '300',
    lineHeight: 28,
    marginBottom: 4,
    opacity: 0.45,
  },
  quote: {
    color: '#FFFFFF',
    fontSize: 20,
    fontStyle: 'italic',
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 28,
    textAlign: 'center',
  },
  attribution: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  reiteration: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
});
