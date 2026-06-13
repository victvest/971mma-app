import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radii, spacing, typography } from '../theme';

type Tone = 'green' | 'red' | 'ink' | 'neutral';

const toneMap: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: colors.accentSoft, fg: colors.accent },
  red: { bg: colors.dangerSoft, fg: colors.danger },
  ink: { bg: '#EEF0F2', fg: colors.text },
  neutral: { bg: colors.bgAlt, fg: colors.textMuted },
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
  const bg = solid ? t.fg : t.bg;
  const fg = solid ? '#fff' : t.fg;
  return (
    <View style={[styles.tag, { backgroundColor: bg }, style]}>
      <Text style={[styles.tagText, { color: fg }]}>{label}</Text>
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
        <Text onPress={onAction} style={styles.sectionAction}>
          {action}
        </Text>
      ) : null}
    </View>
  );
}

export function ProgressBar({
  percent,
  tone = 'green',
  height = 8,
}: {
  percent: number;
  tone?: 'green' | 'red';
  height?: number;
}) {
  const fill = tone === 'red' ? colors.danger : colors.accent;
  return (
    <View style={[styles.track, { height, borderRadius: height }]}>
      <View
        style={{
          width: `${Math.min(100, Math.max(0, percent))}%`,
          height,
          borderRadius: height,
          backgroundColor: fill,
        }}
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.sm,
  },
  tagText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionAction: { fontSize: 13, fontWeight: '700', color: colors.accent },
  track: {
    width: '100%',
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  statLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  statSub: { marginTop: 1, fontSize: 11, color: colors.textFaint, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border },
});
