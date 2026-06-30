import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { UaeFlagMark } from '@/shared/components/brand/UaeFlagMark';
import { useTheme } from '@/shared/theme';

type Props = {
  kicker: string;
  title?: string;
  /** UAE flag before the kicker — reinforces Dubai brand identity. */
  showFlag?: boolean;
};

/** Uppercase kicker + optional section title — shared across About, Legal, Help, etc. */
export function ScreenSectionHeader({ kicker, title, showFlag = true }: Props) {
  const { colors, gap } = useTheme();

  return (
    <View style={[styles.wrap, { gap: gap.xs }]}>
      <View style={styles.kickerRow}>
        {showFlag ? <UaeFlagMark /> : null}
        <Text style={[styles.kicker, { color: colors.accent.default }]}>{kicker}</Text>
      </View>
      {title ? (
        <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 4,
  },
  kickerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 32,
  },
});
