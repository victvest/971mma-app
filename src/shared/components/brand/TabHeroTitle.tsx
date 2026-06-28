import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/shared/theme';

export type TabHeroSegment = {
  text: string;
  accent?: boolean;
};

type Props = {
  /** Each inner array is one visual line; segments within a line can mix primary + accent. */
  lines: TabHeroSegment[][];
  /** Collapse two single-segment lines into one row on wider phones. */
  collapseOnWide?: boolean;
  compactBreakpoint?: number;
};

/**
 * Shared tab hero headline — always uses typography.textPresets.homeHero so Home,
 * Schedule, Check-in, and Coaches titles match exactly.
 */
export function TabHeroTitle({
  lines,
  collapseOnWide = false,
  compactBreakpoint = 360,
}: Props) {
  const { colors, typography } = useTheme();
  const { width } = useWindowDimensions();

  const resolvedLines = useMemo(() => {
    if (
      collapseOnWide &&
      width >= compactBreakpoint &&
      lines.length === 2 &&
      lines.every((line) => line.length === 1)
    ) {
      return [[{ text: `${lines[0][0].text} ` }, lines[1][0]]];
    }
    return lines;
  }, [collapseOnWide, compactBreakpoint, lines, width]);

  return (
    <View style={styles.block}>
      {resolvedLines.map((segments, lineIndex) => (
        <Text
          key={lineIndex}
          style={[
            typography.textPresets.homeHero,
            { color: colors.text.primary, lineHeight: 42 },
          ]}
        >
          {segments.map((segment, segmentIndex) => (
            <Text
              key={segmentIndex}
              style={segment.accent ? { color: colors.accent.default } : undefined}
            >
              {segment.text}
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 0,
  },
});
