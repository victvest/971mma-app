import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { colors, radii, shadow } from '../theme';

const ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Scan: { active: 'qr-code', inactive: 'qr-code-outline' },
  Classes: { active: 'calendar', inactive: 'calendar-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <BlurView intensity={Platform.OS === 'ios' ? 40 : 24} tint="light" style={styles.bar}>
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
              <Pressable key={route.key} onPress={onPress} style={styles.tab} hitSlop={6}>
                <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                  <Ionicons
                    name={isFocused ? icons.active : icons.inactive}
                    size={22}
                    color={isFocused ? '#fff' : colors.textMuted}
                  />
                </View>
                <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 6,
    backgroundColor: 'transparent',
  },
  bar: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(11,11,12,0.06)',
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.72)',
    ...shadow.floating,
  },
  barInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  iconWrap: {
    width: 46,
    height: 34,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.accent },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  labelActive: { color: colors.text },
});
