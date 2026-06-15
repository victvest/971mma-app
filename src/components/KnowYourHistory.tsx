import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts, motion, palette, radii, spacing } from '../theme';
import { GlassSurface } from './GlassSurface';
import { UaeFlagStripe } from './UaeAccent';
import { membership, recentActivity } from '../data/mockData';
import {
  beltJourney,
  rewardsProfile,
  trainingStats,
  type JourneyMilestone,
} from '../data/memberFeatures';

type Accent = 'green' | 'red' | 'ink' | 'gold';

const DOT: Record<Accent, string> = {
  green: palette.green,
  red: palette.red,
  ink: palette.black,
  gold: palette.goldDeep,
};

type Props = {
  memberName?: string;
  beltRank?: string;
  beltStripes?: number;
  onTrainingLog?: () => void;
  onBeltJourney?: () => void;
};

/**
 * v3 signature block — "Know Your History" pairs with Earn Your Level.
 * Milestone scroll + recent mat moments + links to full log.
 */
export function KnowYourHistory({
  memberName,
  beltRank = beltJourney.rank,
  beltStripes = beltJourney.stripes,
  onTrainingLog,
  onBeltJourney,
}: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: motion.duration.normal,
        easing: motion.easing.out,
        useNativeDriver: true,
      }),
      Animated.spring(rise, { toValue: 0, ...motion.springSoft }),
    ]).start();
  }, [fade, rise]);

  const rankLabel = `${beltRank} · ${beltStripes} stripe${beltStripes === 1 ? '' : 's'}`;

  const milestones: JourneyMilestone[] = [
    { id: 'm1', label: 'Member since', value: rewardsProfile.memberSince, tone: 'ink' },
    { id: 'm2', label: 'Sessions logged', value: String(membership.checkInsThisMonth + 33), tone: 'green' },
    { id: 'm3', label: 'Current rank', value: `${beltRank.split(' ')[0]} · ${beltStripes}`, tone: 'red' },
    { id: 'm4', label: 'Day streak', value: String(membership.streakDays), tone: 'red' },
    { id: 'm5', label: '971 points', value: rewardsProfile.points.toLocaleString(), tone: 'gold' },
    { id: 'm6', label: 'Hours on mat', value: String(trainingStats.hoursThisMonth), tone: 'green' },
  ];

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
      <GlassSurface strong tone="green" padding={spacing.lg} radius={radii.xl}>
        <UaeFlagStripe thickness={3} style={styles.flagTop} />

        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Your journey</Text>
            <Text style={styles.title}>
              Know Your <Text style={styles.titleAccent}>History</Text>
            </Text>
            <Text style={styles.sub}>
              {memberName ? `${memberName} · ` : ''}
              Member since {rewardsProfile.memberSince} · {rankLabel}
            </Text>
          </View>
          <View style={styles.rankBadge}>
            <Ionicons name="ribbon" size={20} color={palette.red} />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.milestones}
          decelerationRate="fast"
        >
          {milestones.map((m, i) => (
            <MilestoneChip key={m.id} item={m} index={i} />
          ))}
        </ScrollView>

        <View style={styles.feed}>
          <Text style={styles.feedLabel}>On the mat</Text>
          {recentActivity.slice(0, 4).map((item, i) => (
            <FeedRow key={item.id} {...item} index={i} isLast={i === Math.min(3, recentActivity.length - 1)} />
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onTrainingLog?.();
            }}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionPressed]}
            accessibilityRole="button"
          >
            <LinearGradient colors={[palette.greenBright, palette.greenDeep]} style={styles.actionFill}>
              <Ionicons name="time-outline" size={16} color="#fff" />
              <Text style={styles.actionTextPrimary}>Training log</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onBeltJourney?.();
            }}
            style={({ pressed }) => [styles.actionBtnGhost, pressed && styles.actionPressed]}
            accessibilityRole="button"
          >
            <Ionicons name="medal-outline" size={16} color={palette.red} />
            <Text style={styles.actionTextGhost}>Belt journey</Text>
          </Pressable>
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

function MilestoneChip({ item, index }: { item: JourneyMilestone; index: number }) {
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, delay: 80 + index * 40, ...motion.springSoft }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.duration.fast,
        delay: 80 + index * 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, scale]);

  const border =
    item.tone === 'red'
      ? palette.redLine
      : item.tone === 'gold'
      ? 'rgba(168,132,47,0.35)'
      : item.tone === 'green'
      ? palette.greenLine
      : colors.border;

  const bg =
    item.tone === 'red'
      ? palette.redGlass
      : item.tone === 'gold'
      ? palette.goldGlass
      : item.tone === 'green'
      ? palette.greenGlass
      : palette.inset;

  return (
    <Animated.View style={[styles.chip, { opacity, transform: [{ scale }], borderColor: border, backgroundColor: bg }]}>
      <Text style={styles.chipLabel}>{item.label}</Text>
      <Text style={styles.chipValue}>{item.value}</Text>
    </Animated.View>
  );
}

function FeedRow({
  title,
  detail,
  time,
  accent,
  index,
  isLast,
}: {
  title: string;
  detail: string;
  time: string;
  accent: Accent;
  index: number;
  isLast: boolean;
}) {
  const slide = useRef(new Animated.Value(12)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slide, { toValue: 0, delay: 200 + index * motion.stagger, ...motion.springSoft }),
      Animated.timing(fade, {
        toValue: 1,
        duration: motion.duration.fast,
        delay: 200 + index * motion.stagger,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, index, slide]);

  return (
    <Animated.View style={[styles.feedRow, !isLast && styles.feedBorder, { opacity: fade, transform: [{ translateY: slide }] }]}>
      <View style={[styles.feedDot, { backgroundColor: DOT[accent] }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.feedTitle}>{title}</Text>
        <Text style={styles.feedDetail} numberOfLines={1}>{detail}</Text>
      </View>
      <Text style={styles.feedTime}>{time}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flagTop: { marginBottom: spacing.md, borderRadius: 2, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg },
  kicker: { fontFamily: fonts.semi, fontSize: 12, color: colors.accent, letterSpacing: 0.3 },
  title: {
    fontFamily: fonts.displayBlack,
    fontSize: 28,
    color: colors.text,
    letterSpacing: 0.2,
    lineHeight: 30,
    marginTop: 4,
  },
  titleAccent: { color: palette.red },
  sub: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 18 },
  rankBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.redGlass,
    borderWidth: 1,
    borderColor: palette.redLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestones: { gap: spacing.sm, paddingBottom: spacing.lg },
  chip: {
    minWidth: 108,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  chipLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textFaint },
  chipValue: { fontFamily: fonts.displayBold, fontSize: 17, color: colors.text, marginTop: 4 },
  feed: { marginTop: spacing.xs },
  feedLabel: {
    fontFamily: fonts.semi,
    fontSize: 12,
    color: colors.textFaint,
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  feedBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  feedDot: { width: 8, height: 8, borderRadius: 4 },
  feedTitle: { fontFamily: fonts.semi, fontSize: 14, color: colors.text },
  feedDetail: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  feedTime: { fontFamily: fonts.medium, fontSize: 11, color: colors.textFaint },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { flex: 1, borderRadius: radii.pill, overflow: 'hidden' },
  actionBtnGhost: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.redLine,
    backgroundColor: palette.redGlass,
  },
  actionFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: radii.pill,
  },
  actionTextPrimary: { fontFamily: fonts.semi, fontSize: 13, color: '#fff' },
  actionTextGhost: { fontFamily: fonts.semi, fontSize: 13, color: palette.red },
  actionPressed: { opacity: 0.9 },
});
