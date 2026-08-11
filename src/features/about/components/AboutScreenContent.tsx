import React from 'react';
import { Text, View } from 'react-native';
import { AppScrollView } from '@/shared/components/ui';
import { AboutHero } from '@/features/about/components/AboutHero';
import { AcademyStatsRow } from '@/features/about/components/AcademyStatsRow';
import { MissionSection } from '@/features/about/components/MissionSection';
import { MissionVisionSection } from '@/features/about/components/MissionVisionSection';
import { PhilosophySection } from '@/features/about/components/PhilosophySection';
import { WhyChooseSection } from '@/features/about/components/WhyChooseSection';
import { useTheme } from '@/shared/theme';

export function AboutScreenContent() {
  const { inset, gap, colors, typography } = useTheme();

  return (
    <AppScrollView
      contentContainerStyle={{
        gap: gap.xl,
        paddingHorizontal: inset.lg,
        paddingTop: 8,
        paddingBottom: inset.xl,
      }}
      showsVerticalScrollIndicator={false}
    >
      <AboutHero />
      <AcademyStatsRow />
      <PhilosophySection />
      <MissionSection />
      <MissionVisionSection />
      <WhyChooseSection />

      <View style={{ alignItems: 'center', marginTop: gap.lg, gap: gap.xs }}>
        <Text style={[typography.textPresets.footnote, { color: colors.text.tertiary }]}>
          Designed & Developed by VictVest
        </Text>
        <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>
          © 2026 VictVest. All rights reserved.
        </Text>
      </View>
    </AppScrollView>
  );
}
