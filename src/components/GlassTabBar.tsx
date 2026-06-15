import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { colors, fonts, glass, palette, radii, shadow, spacing } from '../theme';
import { UaeFlagStripe } from './UaeAccent';

const ICONS: Record<
  string,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Classes: { active: 'calendar', inactive: 'calendar-outline' },
  Scan: { active: 'qr-code', inactive: 'qr-code-outline' },
  Belt: { active: 'ribbon', inactive: 'ribbon-outline' },
  Coaches: { active: 'people', inactive: 'people-outline' },
};

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      <View style={[styles.barShell, shadow.floating]}>
        <UaeFlagStripe thickness={2} style={styles.flagTop} />
        <BlurView intensity={glass.blurStrong} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.tintFill]} />
        <LinearGradient
          colors={[glass.sheenTop, 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.sheen}
          pointerEvents="none"
        />
        <View style={styles.barInner}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label = (options.title ?? route.name) as string;
            const isFocused = state.index === index;
            const icons = ICONS[route.name] ?? ICONS.Home;

            const onPress = () => {
              Haptics.selectionAsync().catch(() => {});
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={styles.tab}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={label}
              >
                <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                  <Ionicons
                    name={isFocused ? icons.active : icons.inactive}
                    size={20}
                    color={isFocused ? palette.green : colors.textMuted}
                  />
                </View>
                <Text style={[styles.label, isFocused && styles.labelActive]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: 6,
    backgroundColor: 'transparent',
  },
  barShell: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.hairlineStrong,
  },
  flagTop: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 2,
  },
  tintFill: {
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.7)',
  },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '60%' },
  barInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 0 },
  iconWrap: {
    width: 44,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: palette.hairline,
    ...shadow.soft,
  },
  label: { fontFamily: fonts.medium, fontSize: 10, color: colors.textFaint },
  labelActive: { fontFamily: fonts.bold, color: palette.green },
});
