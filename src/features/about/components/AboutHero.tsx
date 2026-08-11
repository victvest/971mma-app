import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ABOUT_INTRO } from '@/features/about/content/academyContent';
import { AboutContentCard } from '@/features/about/components/AboutContentCard';
import { AboutSectionHeader } from '@/features/about/components/AboutSectionHeader';
import { academyAssets } from '@/features/academy/assets';
import { MediaBackground } from '@/shared/components/MediaBackground';
import { RevealOnMount } from '@/shared/animations';
import { useTheme } from '@/shared/theme';

export function AboutHero() {
  const { colors, gap, typography, radius, inset } = useTheme();

  return (
    <RevealOnMount style={{ gap: gap.md }}>
      <AboutSectionHeader kicker="ABOUT US" />
      <Text style={[typography.textPresets.homeHero, { color: colors.text.primary }]}>
        Earn Your <Text style={{ color: colors.accent.default }}>Level.</Text>
      </Text>

      <MediaBackground
        source={academyAssets.academyTeam}
        style={[styles.communityImage, { borderRadius: radius.cardLarge }]}
        borderRadius={radius.cardLarge}
      >
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.media.scrimBottom, opacity: 0.35 },
          ]}
        />
        <View style={[styles.communityLabel, { padding: inset.md }]}>
          <Text style={[typography.textPresets.label, { color: colors.text.inverse }]}>
            OUR COMMUNITY
          </Text>
        </View>
      </MediaBackground>

      <AboutContentCard>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{ABOUT_INTRO}</Text>
      </AboutContentCard>
    </RevealOnMount>
  );
}

const styles = StyleSheet.create({
  communityImage: {
    minHeight: 280,
    overflow: 'hidden',
  },
  communityLabel: {
    flex: 1,
    justifyContent: 'flex-end',
    minHeight: 280,
    zIndex: 1,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
});
