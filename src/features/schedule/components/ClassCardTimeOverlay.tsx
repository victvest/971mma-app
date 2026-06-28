import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { parseScheduleCardTime } from '@/features/schedule/utils/formatScheduleTime';
import { useTheme } from '@/shared/theme';

type Props = {
  startsAt: string;
};

export const ClassCardTimeOverlay = memo(function ClassCardTimeOverlay({ startsAt }: Props) {
  const { colors } = useTheme();
  const { label, time } = parseScheduleCardTime(startsAt);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.solidBar, { backgroundColor: colors.media.scrimBottom }]} />
      <View style={styles.textBlock}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.time}>{time}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
  },
  solidBar: {
    ...StyleSheet.absoluteFill,
    opacity: 0.92,
  },
  textBlock: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 28,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  time: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 34,
    marginTop: 2,
  },
});
