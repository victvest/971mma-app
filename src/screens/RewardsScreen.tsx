import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, palette, radii, spacing, typography } from '../theme';
import { GlassNavBar } from '../components/GlassNavBar';
import { ScreenShell } from '../components/ScreenShell';
import { GlassSurface } from '../components/GlassSurface';
import { FeatureIcon } from '../components/icons/FeatureIcon';
import { StatRing } from '../components/tracking/StatRing';
import { ProgressBar, SectionHeader } from '../components/primitives';
import { recentRewardEvents, rewardCatalog, rewardsProfile, type RewardItem } from '../data/memberFeatures';
import type { MainStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const ICON_MAP: Record<RewardItem['icon'], React.ComponentProps<typeof FeatureIcon>['name']> = {
  gift: 'gift',
  shirt: 'rewards',
  ticket: 'pass',
  coffee: 'rewards',
};

export function RewardsScreen() {
  const navigation = useNavigation<Nav>();
  const tierPct = Math.round(
    (rewardsProfile.points / (rewardsProfile.points + rewardsProfile.pointsToNext)) * 100,
  );

  return (
    <ScreenShell>
      <StatusBar style="dark" />
      <GlassNavBar title="Rewards" subtitle="Earn Your Level · 971 Points" showBell={false} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.ringsRow}>
          <StatRing value={rewardsProfile.points} max={1500} label="Points" sub="available" tone="gold" size={100} />
          <View style={styles.pointsHero}>
          <LinearGradient
            colors={[palette.greenDeep, palette.green, palette.greenBright]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.heroSheen}
            pointerEvents="none"
          />
          <Text style={styles.pointsLabel}>Available points</Text>
          <Text style={styles.pointsValue}>{rewardsProfile.points.toLocaleString()}</Text>
          <View style={styles.tierRow}>
            <Text style={styles.tierText}>{rewardsProfile.tier} tier</Text>
            <Text style={styles.tierNext}>{rewardsProfile.pointsToNext} to {rewardsProfile.nextTier}</Text>
          </View>
          <ProgressBar percent={tierPct} height={6} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Redeem" />
          <View style={{ gap: spacing.sm }}>
            {rewardCatalog.map((item) => (
              <GlassSurface key={item.id} padding={spacing.lg} tone={item.available ? 'gold' : 'neutral'}>
                <View style={styles.rewardRow}>
                  <FeatureIcon name={ICON_MAP[item.icon]} size={44} tone={item.available ? 'gold' : 'ink'} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rewardTitle}>{item.title}</Text>
                    <Text style={styles.rewardDesc}>{item.description}</Text>
                  </View>
                  <View style={[styles.costPill, !item.available && styles.costPillLocked]}>
                    <Text style={[styles.costText, !item.available && { color: colors.textFaint }]}>{item.cost} pts</Text>
                  </View>
                </View>
              </GlassSurface>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Recent earnings" />
          <GlassSurface padding={false}>
            {recentRewardEvents.map((e, i) => (
              <View key={e.id} style={[styles.earnRow, i < recentRewardEvents.length - 1 && styles.earnBorder]}>
                <View>
                  <Text style={styles.earnTitle}>{e.title}</Text>
                  <Text style={styles.earnWhen}>{e.when}</Text>
                </View>
                <Text style={styles.earnPts}>+{e.points}</Text>
              </View>
            ))}
          </GlassSurface>
        </View>

        <Pressable style={styles.linkRow} onPress={() => navigation.navigate('Training')}>
          <Text style={styles.linkText}>See session history</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.accent} />
        </Pressable>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: 132 },
  ringsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, alignItems: 'center' },
  pointsHero: {
    flex: 1,
    borderRadius: radii.xl,
    overflow: 'hidden',
    padding: spacing.xl,
    minHeight: 160,
  },
  heroSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
  pointsLabel: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  pointsValue: { fontFamily: fonts.displayBlack, fontSize: 42, color: '#fff', marginTop: 4 },
  tierRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.sm },
  tierText: { fontFamily: fonts.semi, fontSize: 13, color: '#fff' },
  tierNext: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  section: { marginTop: spacing.xxl },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rewardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.goldGlass,
    borderWidth: 1,
    borderColor: 'rgba(168,132,47,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardIconLocked: { backgroundColor: palette.inset, borderColor: colors.border },
  rewardTitle: { fontFamily: fonts.semi, fontSize: 15, color: colors.text },
  rewardDesc: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 17 },
  costPill: {
    backgroundColor: palette.goldGlass,
    borderWidth: 1,
    borderColor: 'rgba(168,132,47,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  costPillLocked: { backgroundColor: palette.inset, borderColor: colors.border },
  costText: { fontFamily: fonts.bold, fontSize: 12, color: palette.goldDeep },
  earnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  earnBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  earnTitle: { fontFamily: fonts.semi, fontSize: 14, color: colors.text },
  earnWhen: { fontFamily: fonts.medium, fontSize: 12, color: colors.textFaint, marginTop: 2 },
  earnPts: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.accent },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.xxl },
  linkText: { fontFamily: fonts.semi, fontSize: 14, color: colors.accent },
});
