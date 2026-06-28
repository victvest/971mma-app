import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/shared/theme';

type AccentTone = 'brand' | 'live' | 'muted' | 'none';

type Props = {
  title: string;
  children: ReactNode;
  accent?: AccentTone;
  /** Optional trailing element on the title row (e.g. a "Schedule →" link). */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Hairline divider above the section — default true. */
  showDivider?: boolean;
};

/** Flat editorial section for detail screens — no elevated card shell. */
export function DetailSectionCard({
  title,
  children,
  accent = 'none',
  trailing,
  style,
  showDivider = true,
}: Props) {
  const { colors, typography, gap, layout, inset } = useTheme();

  const accentColor =
    accent === 'live'
      ? colors.status.live
      : accent === 'muted'
        ? colors.text.tertiary
        : accent === 'brand'
          ? colors.accent.default
          : 'transparent';

  return (
    <View
      style={[
        styles.section,
        showDivider && {
          borderTopColor: colors.border.subtle,
          borderTopWidth: layout.borderWidth,
          paddingTop: inset.xl,
        },
        style,
      ]}
    >
      <View style={styles.titleRow}>
        <View style={[styles.titleLeft, { gap: gap.sm }]}>
          {accent !== 'none' ? (
            <View style={[styles.accentDot, { backgroundColor: accentColor }]} />
          ) : null}
          <Text
            style={[
              typography.textPresets.subtitle,
              styles.sectionTitle,
              { color: colors.text.primary },
            ]}
          >
            {title}
          </Text>
        </View>
        {trailing}
      </View>
      <View style={{ gap: gap.md, marginTop: gap.md }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  titleLeft: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  accentDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  sectionTitle: {
    letterSpacing: -0.2,
  },
});
