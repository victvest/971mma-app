import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { colors, fonts, glass, palette, radii, shadow, spacing } from '../theme';
import { Logo } from './Logo';
import { AppIcon, type AppIconName } from './icons/FeatureIcon';
import { UaeFlagStripe } from './UaeAccent';
import { useMenu } from '../context/MenuContext';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { membership } from '../data/mockData';
import { rewardsProfile } from '../data/memberFeatures';
import type { MainStackParamList } from '../navigation/types';

const heroImg = require('../../assets/images/hero-bjj.jpg');
const WIDTH = Math.min(320, Dimensions.get('window').width * 0.86);

type Nav = NativeStackNavigationProp<MainStackParamList>;

type Item = {
  label: string;
  icon: AppIconName;
  tone?: 'green' | 'gold' | 'red' | 'ink' | 'neutral';
  route: keyof MainStackParamList | 'Tabs';
  tab?: keyof import('../navigation/types').TabsParamList;
  badge?: string;
};

const PRIMARY: Item[] = [
  { label: 'Home', icon: 'home', tone: 'green', route: 'Tabs', tab: 'Home' },
  { label: 'Member pass', icon: 'pass', tone: 'ink', route: 'Tabs', tab: 'Scan' },
  { label: 'Schedule', icon: 'schedule', tone: 'green', route: 'Tabs', tab: 'Classes' },
  { label: 'Training log', icon: 'training', tone: 'green', route: 'Training', badge: `${membership.checkInsThisMonth}` },
  { label: 'Rewards', icon: 'rewards', tone: 'gold', route: 'Rewards', badge: `${rewardsProfile.points}` },
  { label: 'Belt journey', icon: 'belt', tone: 'red', route: 'BeltJourney' },
  { label: 'Profile', icon: 'profile', tone: 'ink', route: 'Tabs', tab: 'Profile' },
];

const SECONDARY: Item[] = [
  { label: 'Membership', icon: 'membership', tone: 'gold', route: 'Tabs', tab: 'Profile' },
  { label: 'Notifications', icon: 'notifications', tone: 'neutral', route: 'Tabs', tab: 'Home' },
  { label: 'Help & support', icon: 'help', tone: 'neutral', route: 'Tabs', tab: 'Profile' },
];

export function SideMenu() {
  const { visible, closeMenu } = useMenu();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useProfile();
  const slide = useRef(new Animated.Value(-WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slide, {
        toValue: visible ? 0 : -WIDTH,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
      }),
      Animated.timing(fade, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(heroSlide, {
        toValue: visible ? 0 : -16,
        duration: 380,
        easing: undefined,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, slide, fade, heroSlide]);

  const go = (item: Item) => {
    Haptics.selectionAsync().catch(() => {});
    closeMenu();
    if (item.route === 'Tabs' && item.tab) {
      navigation.navigate('Tabs', { screen: item.tab });
      return;
    }
    navigation.navigate(item.route as Exclude<Item['route'], 'Tabs'>);
  };

  const name = profile?.fullName || user?.email?.split('@')[0] || 'Member';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeMenu}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: fade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} accessibilityLabel="Close menu" />
        </Animated.View>

        <Animated.View style={[styles.panel, { transform: [{ translateX: slide }] }]}>
          <UaeFlagStripe orientation="vertical" thickness={3} style={styles.flagEdge} />
          <BlurView intensity={glass.blurStrong} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.panelTint} />

          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero strip — coach on the mat */}
            <Animated.View style={[styles.heroStrip, { transform: [{ translateY: heroSlide }] }]}>
              <Image source={heroImg} style={styles.heroImg} resizeMode="cover" />
              <LinearGradient
                colors={['rgba(4,8,6,0.1)', 'rgba(4,8,6,0.75)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.heroContent, { paddingTop: insets.top + spacing.md }]}>
                <View style={styles.heroBrand}>
                  <Logo size={22} tint="white" />
                  <Text style={styles.heroBrandText}>971 MMA</Text>
                </View>
                <Text style={styles.heroTagline}>
                  Earn Your <Text style={styles.heroAccent}>Level</Text>
                </Text>
                <Text style={styles.heroSub}>Train · Track · Rise</Text>
              </View>
            </Animated.View>

            <View style={styles.body}>
              <View style={styles.memberCard}>
                <Text style={styles.memberName} numberOfLines={1}>{name}</Text>
                <Text style={styles.memberMeta}>{membership.plan} · {membership.memberId}</Text>
                <View style={styles.memberStats}>
                  <MiniStat label="Points" value={String(rewardsProfile.points)} />
                  <MiniStat label="Streak" value={`${membership.streakDays}d`} accent="red" />
                  <MiniStat label="Sessions" value={String(membership.checkInsThisMonth)} />
                </View>
              </View>

              <Text style={styles.sectionLabel}>Navigate</Text>
              {PRIMARY.map((item, i) => (
                <MenuRow key={item.label} item={item} index={i} visible={visible} onPress={() => go(item)} />
              ))}

              <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Account</Text>
              {SECONDARY.map((item, i) => (
                <MenuRow key={item.label} item={item} index={i} visible={visible} muted onPress={() => go(item)} />
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function MenuRow({
  item,
  index,
  visible,
  onPress,
  muted,
}: {
  item: Item;
  index: number;
  visible: boolean;
  onPress: () => void;
  muted?: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(anim, {
        toValue: 1,
        duration: 360,
        delay: 80 + index * 45,
        useNativeDriver: true,
      }).start();
    } else {
      anim.setValue(0);
    }
  }, [anim, index, visible]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateX }] }}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} accessibilityRole="button">
        <AppIcon name={item.icon} size={40} tone={item.tone ?? 'green'} />
        <Text style={[styles.rowLabel, muted && { color: colors.textMuted }]}>{item.label}</Text>
        {item.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      </Pressable>
    </Animated.View>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: 'red' }) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniValue, accent === 'red' && { color: palette.red }]}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11,15,18,0.4)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: WIDTH,
    borderRightWidth: 1,
    borderRightColor: palette.hairlineStrong,
    ...shadow.floating,
    overflow: 'hidden',
  },
  flagEdge: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 3,
  },
  panelTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.78)' },
  heroStrip: { height: 168, overflow: 'hidden' },
  heroImg: { width: '100%', height: '100%' },
  heroContent: { ...StyleSheet.absoluteFill, paddingHorizontal: spacing.lg, justifyContent: 'flex-end', paddingBottom: spacing.lg },
  heroBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  heroBrandText: { fontFamily: fonts.displayBold, fontSize: 16, color: '#fff', letterSpacing: 0.4 },
  heroTagline: { fontFamily: fonts.displayBlack, fontSize: 26, color: '#fff', letterSpacing: 0.3 },
  heroAccent: { color: palette.redBright },
  heroSub: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  memberCard: {
    backgroundColor: palette.greenGlass,
    borderWidth: 1,
    borderColor: palette.greenLine,
    borderBottomColor: palette.redLine,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  memberName: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  memberMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 4 },
  memberStats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  miniStat: { flex: 1 },
  miniValue: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.accent },
  miniLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textFaint, marginTop: 2 },
  sectionLabel: {
    fontFamily: fonts.semi,
    fontSize: 12,
    color: colors.textFaint,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: radii.md,
  },
  rowPressed: { backgroundColor: palette.inset },
  rowLabel: { flex: 1, fontFamily: fonts.semi, fontSize: 15, color: colors.text },
  badge: {
    backgroundColor: palette.greenGlass,
    borderWidth: 1,
    borderColor: palette.greenLine,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.accent },
});
