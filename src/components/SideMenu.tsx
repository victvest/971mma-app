import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
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
import { useMenu } from '../context/MenuContext';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { membership } from '../data/mockData';
import { rewardsProfile } from '../data/memberFeatures';
import type { MainStackParamList } from '../navigation/types';

const WIDTH = Math.min(320, Dimensions.get('window').width * 0.86);

type Nav = NativeStackNavigationProp<MainStackParamList>;

type Item = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: keyof MainStackParamList | 'Tabs';
  tab?: keyof import('../navigation/types').TabsParamList;
  badge?: string;
};

const PRIMARY: Item[] = [
  { label: 'Home', icon: 'home-outline', route: 'Tabs', tab: 'Home' },
  { label: 'Member pass', icon: 'qr-code-outline', route: 'Tabs', tab: 'Scan' },
  { label: 'Schedule', icon: 'calendar-outline', route: 'Tabs', tab: 'Classes' },
  { label: 'Training log', icon: 'pulse-outline', route: 'Training', badge: `${membership.checkInsThisMonth}` },
  { label: 'Rewards', icon: 'gift-outline', route: 'Rewards', badge: `${rewardsProfile.points}` },
  { label: 'Belt journey', icon: 'ribbon-outline', route: 'BeltJourney' },
  { label: 'Profile', icon: 'person-outline', route: 'Tabs', tab: 'Profile' },
];

const SECONDARY: Item[] = [
  { label: 'Membership', icon: 'card-outline', route: 'Tabs', tab: 'Profile' },
  { label: 'Notifications', icon: 'notifications-outline', route: 'Tabs', tab: 'Home' },
  { label: 'Help & support', icon: 'help-circle-outline', route: 'Tabs', tab: 'Profile' },
];

export function SideMenu() {
  const { visible, closeMenu } = useMenu();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useProfile();
  const slide = useRef(new Animated.Value(-WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

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
    ]).start();
  }, [visible, slide, fade]);

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
          <BlurView intensity={glass.blurStrong} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.panelTint} />
          <LinearGradient
            colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.7)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.panelSheen}
            pointerEvents="none"
          />

          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.brandRow}>
              <View style={styles.logoWrap}>
                <Logo size={28} tint="black" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.brand}>971 MMA</Text>
                <Text style={styles.brandSub}>Fitness Academy</Text>
              </View>
            </View>

            <View style={styles.memberCard}>
              <Text style={styles.memberName} numberOfLines={1}>{name}</Text>
              <Text style={styles.memberMeta}>{membership.plan} · {membership.memberId}</Text>
              <View style={styles.memberStats}>
                <MiniStat label="Points" value={String(rewardsProfile.points)} />
                <MiniStat label="Streak" value={`${membership.streakDays}d`} />
                <MiniStat label="Sessions" value={String(membership.checkInsThisMonth)} />
              </View>
            </View>

            <Text style={styles.sectionLabel}>Navigate</Text>
            {PRIMARY.map((item) => (
              <MenuRow key={item.label} item={item} onPress={() => go(item)} />
            ))}

            <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Account</Text>
            {SECONDARY.map((item) => (
              <MenuRow key={item.label} item={item} onPress={() => go(item)} muted />
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function MenuRow({ item, onPress, muted }: { item: Item; onPress: () => void; muted?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} accessibilityRole="button">
      <View style={[styles.rowIcon, muted && styles.rowIconMuted]}>
        <Ionicons name={item.icon} size={20} color={muted ? colors.textMuted : colors.text} />
      </View>
      <Text style={[styles.rowLabel, muted && { color: colors.textMuted }]}>{item.label}</Text>
      {item.badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11,15,18,0.35)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: WIDTH,
    borderRightWidth: 1,
    borderRightColor: palette.hairlineStrong,
    ...shadow.floating,
  },
  panelTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.72)' },
  panelSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
  scroll: { paddingHorizontal: spacing.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: palette.glass12,
    borderWidth: 1,
    borderColor: palette.greenLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.text },
  brandSub: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  memberCard: {
    backgroundColor: palette.greenGlass,
    borderWidth: 1,
    borderColor: palette.greenLine,
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
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: radii.md,
  },
  rowPressed: { backgroundColor: palette.inset },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: palette.glass08,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconMuted: { backgroundColor: palette.inset },
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
