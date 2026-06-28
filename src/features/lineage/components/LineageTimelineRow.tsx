import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import type { LineageEntryItem } from '@/types/domain';

type LineageTimelineRowProps = {
  entry: LineageEntryItem;
  isLast: boolean;
  isActive: boolean;
};

export const LineageTimelineRow = memo(function LineageTimelineRow({
  entry,
  isLast,
  isActive,
}: LineageTimelineRowProps) {
  const { colors, typography, gap } = useTheme();

  const roleLine = [entry.role, entry.note].filter(Boolean).join(' · ');

  return (
    <View style={styles.row}>
      <View style={styles.railCol}>
        <View
          style={[
            styles.dot,
            isActive
              ? { backgroundColor: colors.accent.default, borderColor: colors.accent.default }
              : {
                  backgroundColor: colors.background.primary,
                  borderColor: colors.border.default,
                  borderWidth: 2,
                },
          ]}
        />
        {!isLast ? (
          <View style={[styles.line, { backgroundColor: colors.border.subtle }]} />
        ) : null}
      </View>

      <View style={[styles.content, { gap: gap.xs }]}>
        <Text
          style={[
            typography.textPresets.metricLabel,
            { color: colors.accent.default, textTransform: 'uppercase' },
          ]}
        >
          {entry.yearLabel}
        </Text>
        <Text style={[styles.name, { color: colors.text.primary }]}>{entry.name}</Text>
        {roleLine ? (
          <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
            {roleLine}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 14,
    minHeight: 72,
  },
  railCol: {
    width: 18,
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: 6,
    minHeight: 48,
  },
  content: {
    flex: 1,
    paddingBottom: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
});
