import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts, glass, palette, radii, shadow, spacing } from '../theme';
import { UaeFlagIcon } from './UaeFlagIcon';
import { useMenu } from '../context/MenuContext';
import type { MainStackParamList } from '../navigation/types';

type Props = {
  memberName: string;
  initials: string;
  showBack?: boolean;
};

export function AcademyHeader({ memberName, initials, showBack }: Props) {
  const insets = useSafeAreaInsets();
  const { openMenu } = useMenu();
  const nav = useNavigation();
  const stackNav = nav.getParent<NativeStackNavigationProp<MainStackParamList>>();

  const openProfile = () => {
    if (stackNav) {
      stackNav.navigate('Profile');
      return;
    }
    nav.navigate('Profile' as never);
  };

  return (
    <View style={[styles.outer, { paddingTop: insets.top + 8 }]}>
      <View style={[styles.bar, shadow.soft]}>
        <BlurView intensity={glass.blurStrong} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.tint} />
        <View style={styles.row}>
          <Pressable
            onPress={showBack ? () => nav.goBack() : openMenu}
            style={styles.iconBtn}
            accessibilityLabel={showBack ? 'Back' : 'Menu'}
          >
            <Ionicons name={showBack ? 'chevron-back' : 'menu'} size={22} color={colors.text} />
          </Pressable>

          <View style={styles.center}>
            <UaeFlagIcon />
            <View>
              <Text style={styles.academy}>971 ACADEMY</Text>
              <Text style={styles.name}>{memberName}</Text>
            </View>
          </View>

          <View style={styles.right}>
            <Pressable style={styles.iconBtn} accessibilityLabel="Notifications">
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
              <View style={styles.dot} />
            </Pressable>
            <Pressable onPress={openProfile} style={styles.avatar} accessibilityLabel="Profile">
              <Text style={styles.avatarText}>{initials}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, zIndex: 10 },
  bar: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.hairlineStrong,
    ...Platform.select({ web: { backdropFilter: 'blur(24px)' as any }, default: {} }),
  },
  tint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.72)' },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: spacing.sm },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  center: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  academy: { fontFamily: fonts.bold, fontSize: 10, color: colors.textMuted, letterSpacing: 1.2 },
  name: { fontFamily: fonts.semi, fontSize: 15, color: colors.text, marginTop: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.red,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff', letterSpacing: 0.5 },
});
