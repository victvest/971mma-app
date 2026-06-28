import React from 'react';
import { AppScrollView } from '@/shared/components/ui';
import { AboutHero } from '@/features/about/components/AboutHero';
import { AcademyStatsRow } from '@/features/about/components/AcademyStatsRow';
import { MissionSection } from '@/features/about/components/MissionSection';
import { MissionVisionSection } from '@/features/about/components/MissionVisionSection';
import { PhilosophySection } from '@/features/about/components/PhilosophySection';
import { WhyChooseSection } from '@/features/about/components/WhyChooseSection';
import { useTheme } from '@/shared/theme';

export function AboutScreenContent() {
  const { inset, gap } = useTheme();

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
    </AppScrollView>
  );
}
