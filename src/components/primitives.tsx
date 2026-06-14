import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, palette, radii, spacing, typography } from '../theme';

type Tone = 'green' | 'red' | 'ink' | 'neutral' | 'gold';

const toneMap: Record<
  Tone,
  { bg: string; fg: string; border: string; solidBg: string; solidFg: string }
> = {
  green: { bg: palette.greenGlass, fg: palette.greenBright, border: palette.greenLine, solidBg: palette.green, solidFg: '#04150C' },
  red: { bg: palette.redGlass, fg: palette.redBright, border: 'rgba(255,59,78,0.35)', solidBg: palette.red, solidFg: '#fff' },
  ink: { bg: palette.glass08, fg: colors.text, border: colors.borderStrong, solidBg: '#F2F5F9', solidFg: palette.ink900 },
  neutral: { bg: palette.glass06, fg: colors.textMuted, border: colors.border, solidBg: palette.glass16, solidFg: colors.text },
  gold: { bg: palette.goldGlass, fg: palette.goldBright, border: 'rgba(231,199,122,0.38)', solidBg: palette.gold, solidFg: '#1B1403' },
};

export function Tag({
  label,
  tone = 'green',
  style,
  solid,
}: {
  label: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
  solid?: boolean;
}) {
  const t = toneMap[tone];
  return (
    <View
      style={[
        styles.tag,
        solid
          ? { backgroundColor: t.solidBg, borderColor: t.solidBg }
          : { backgroundColor: t.bg, borderColor: t.border },
        style,
      ]}
    >
      <Text style={[styles.tagText, { color: solid ? t.solidFg : t.fg }]}>{label}</Text>
    </View>
  );
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[typography.label, { color: colors.textFaint }, style]}>{children}</Text>;
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[typography.h3, { color: colors.text }]}>{title}</Text>
      {action ? (
        <Text onPress={onAction} suppressHighlighting style={styles.sectionAction}>
          {action}
        </Text>
      ) : null}
    </View>
  );
}

export function ProgressBar({
  percent,
  tone = 'green',
  height = 9,
}: {
  percent: number;
  tone?: 'green' | 'red' | 'gold';
  height?: number;
}) {
  const grad: readonly [string, string, ...string[]] =
    tone === 'red'
      ? [palette.redBright, palette.red]
      : tone === 'gold'
      ? [palette.goldBright, palette.gold]
      : [palette.greenBright, palette.green];
  const pct = Math.min(100, Math.max(0, percent));
  return (
    <View style={[styles.track, { height, borderRadius: height }]}>
      <LinearGradient
        colors={grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: `${pct}%`, height, borderRadius: height }}
      />
    </View>
  );
}

export function StatBox({
  value,
  label,
  sub,
  style,
}: {
  value: string;
  label: string;
  sub?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.statBox, style]}>
      <Text style={[typography.stat, { color: colors.text }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  tagText: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionAction: { fontFamily: fonts.bold, fontSize: 13, color: colors.accentBright },
  track: {
    width: '100%',
    backgroundColor: palette.glass08,
    overflow: 'hidden',
  },
  statBox: {
    flex: 1,
    backgroundColor: palette.glass06,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  statLabel: { marginTop: 6, fontFamily: fonts.bold, fontSize: 12, color: colors.text },
  statSub: { marginTop: 1, fontFamily: fonts.medium, fontSize: 11, color: colors.textFaint },
  divider: { height: 1, backgroundColor: colors.border },
});
