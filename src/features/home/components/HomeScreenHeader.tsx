import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AcademyEyebrow,
  TabHeroTitle,
  type TabHeroSegment,
} from '@/shared/components/brand';
import { useTheme } from '@/shared/theme';

const DEFAULT_TITLE_LINES: TabHeroSegment[][] = [
  [{ text: 'Earn your ' }, { text: 'level.', accent: true }],
];

type Props = {
  eyebrowLabel: string;
  titleLines?: TabHeroSegment[][];
  showFlag?: boolean;
  collapseOnWide?: boolean;
};

export function HomeScreenHeader({
  eyebrowLabel,
  titleLines = DEFAULT_TITLE_LINES,
  showFlag = true,
  collapseOnWide = true,
}: Props) {
  const { gap } = useTheme();

  return (
    <View style={[styles.container, { gap: gap.md }]}>
      <AcademyEyebrow label={eyebrowLabel} accent showFlag={showFlag} />
      <TabHeroTitle collapseOnWide={collapseOnWide} lines={titleLines} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
});
