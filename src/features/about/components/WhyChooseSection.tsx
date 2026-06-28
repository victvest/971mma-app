import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Award, Dumbbell, LayoutGrid, Users, type LucideIcon } from 'lucide-react-native';
import { WHY_CHOOSE_US } from '@/features/about/content/academyContent';
import { AboutContentCard } from '@/features/about/components/AboutContentCard';
import { AboutSectionHeader } from '@/features/about/components/AboutSectionHeader';
import { RevealOnMount } from '@/shared/animations';
import { useTheme } from '@/shared/theme';

const WHY_ICONS: LucideIcon[] = [LayoutGrid, Dumbbell, Users, Award];

function WhyCard({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  const { colors, gap } = useTheme();

  return (
    <AboutContentCard style={styles.card}>
      <Icon color={colors.accent.default} size={22} strokeWidth={2} />
      <Text style={[styles.title, { color: colors.text.primary, marginTop: gap.sm }]}>{title}</Text>
    </AboutContentCard>
  );
}

export function WhyChooseSection() {
  const { gap } = useTheme();

  return (
    <RevealOnMount delay={160} style={{ gap: gap.md }}>
      <AboutSectionHeader kicker="WHY 971 MMA" title="Why Choose Us" />
      <View style={[styles.grid, { gap: gap.sm }]}>
        {WHY_CHOOSE_US.map((item, index) => (
          <WhyCard key={item.title} title={item.title} icon={WHY_ICONS[index]!} />
        ))}
      </View>
    </RevealOnMount>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    flexGrow: 1,
    minHeight: 120,
    width: '47%',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
});
