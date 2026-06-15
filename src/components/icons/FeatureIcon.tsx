import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, palette, radii } from '../../theme';

export type AppIconName =
  | 'home'
  | 'pass'
  | 'schedule'
  | 'training'
  | 'rewards'
  | 'belt'
  | 'profile'
  | 'gift'
  | 'flame'
  | 'time'
  | 'membership'
  | 'notifications'
  | 'help';

type Tone = 'green' | 'gold' | 'red' | 'ink' | 'neutral';

type IconDef =
  | { set: 'ion'; name: keyof typeof Ionicons.glyphMap }
  | { set: 'mci'; name: keyof typeof MaterialCommunityIcons.glyphMap };

const ICONS: Record<AppIconName, IconDef> = {
  home: { set: 'ion', name: 'home' },
  pass: { set: 'ion', name: 'qr-code' },
  schedule: { set: 'ion', name: 'calendar' },
  training: { set: 'mci', name: 'dumbbell' },
  rewards: { set: 'ion', name: 'trophy' },
  belt: { set: 'mci', name: 'karate' },
  profile: { set: 'ion', name: 'person' },
  gift: { set: 'ion', name: 'gift' },
  flame: { set: 'ion', name: 'flame' },
  time: { set: 'ion', name: 'time' },
  membership: { set: 'ion', name: 'card' },
  notifications: { set: 'ion', name: 'notifications' },
  help: { set: 'ion', name: 'help-circle' },
};

const TONE: Record<Tone, { bg: string; border: string; fg: string }> = {
  green: { bg: palette.greenGlass, border: palette.greenLine, fg: palette.green },
  gold: { bg: palette.goldGlass, border: 'rgba(168,132,47,0.3)', fg: palette.goldDeep },
  red: { bg: palette.redGlass, border: palette.redLine, fg: palette.red },
  ink: { bg: palette.inset, border: colors.borderStrong, fg: colors.text },
  neutral: { bg: palette.glass08, border: colors.border, fg: colors.textMuted },
};

type Props = {
  name: AppIconName;
  size?: number;
  tone?: Tone;
  style?: ViewStyle;
};

/**
 * Premium icon badge — professional Ionicons / MaterialCommunityIcons
 * on a frosted tint plate. No homemade SVG glyphs.
 */
export function AppIcon({ name, size = 44, tone = 'green', style }: Props) {
  const def = ICONS[name];
  const t = TONE[tone];
  const iconSize = Math.round(size * 0.48);

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.32),
          backgroundColor: t.bg,
          borderColor: t.border,
        },
        style,
      ]}
    >
      {def.set === 'mci' ? (
        <MaterialCommunityIcons name={def.name} size={iconSize} color={t.fg} />
      ) : (
        <Ionicons name={def.name} size={iconSize} color={t.fg} />
      )}
    </View>
  );
}

/** @deprecated Use AppIcon — alias kept so existing imports keep working. */
export const FeatureIcon = AppIcon;

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
