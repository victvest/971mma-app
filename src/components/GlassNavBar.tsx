import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, glass, palette, radii, shadow, spacing } from '../theme';
import { Logo } from './Logo';
import { useMenu } from '../context/MenuContext';
import { UaeFlagStripe } from './UaeAccent';

type Props = {
  title?: string;
  subtitle?: string;
  showMenu?: boolean;
  showBell?: boolean;
  onBell?: () => void;
  compact?: boolean;
};

export function GlassNavBar({
  title = '971 MMA',
  subtitle,
  showMenu = true,
  showBell = true,
  onBell,
  compact = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { openMenu } = useMenu();

  return (
    <View style={[styles.outer, { paddingTop: insets.top + 6 }]}>
      <View style={[styles.bar, shadow.soft]}>
        <UaeFlagStripe orientation="vertical" thickness={3} style={styles.flagEdge} />
        <BlurView intensity={glass.blurStrong} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.tint} />
        <LinearGradient
          colors={['rgba(255,255,255,0.92)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.15)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.sheen}
          pointerEvents="none"
        />
        <View style={styles.rim} pointerEvents="none" />

        <View style={styles.row}>
          {showMenu ? (
            <Pressable
              onPress={openMenu}
              style={styles.iconBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open menu"
            >
              <Ionicons name="menu" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.iconSpacer} />
          )}

          <View style={styles.center}>
            {!compact ? (
              <View style={styles.logoMini}>
                <Logo size={18} tint="black" />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitle.includes('Level') ? (
                    <>
                      {subtitle.replace(' Level', '')}
                      <Text style={styles.subtitleAccent}> Level</Text>
                    </>
                  ) : (
                    subtitle
                  )}
                </Text>
              ) : null}
            </View>
          </View>

          {showBell ? (
            <Pressable
              onPress={onBell}
              style={styles.iconBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
              <View style={styles.dot} />
            </Pressable>
          ) : (
            <View style={styles.iconSpacer} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    zIndex: 20,
  },
  bar: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    ...Platform.select({
      web: { backdropFilter: 'blur(28px) saturate(180%)' as any },
      default: {},
    }),
  },
  flagEdge: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    zIndex: 2,
  },
  tint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.55)',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '70%',
  },
  rim: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.98)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  iconSpacer: { width: 42, height: 42 },
  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  logoMini: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: palette.greenLine,
    borderLeftColor: palette.redLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 17,
    color: colors.text,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  subtitleAccent: {
    color: palette.red,
    fontFamily: fonts.semi,
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});
