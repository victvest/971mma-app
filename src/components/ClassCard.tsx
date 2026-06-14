import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, spacing } from '../theme';
import { GymClass } from '../data/mockData';
import { Tag } from './primitives';
import { GlassSurface } from './GlassSurface';

type Props = {
  item: GymClass;
  onPress?: () => void;
  compact?: boolean;
};

/** Read-only schedule row — no booking (members walk in and train). */
export function ClassCard({ item, onPress, compact }: Props) {
  const tone = item.accent === 'red' ? 'red' : item.accent === 'ink' ? 'ink' : 'green';

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <GlassSurface padding={false} radius={radii.md} style={styles.wrap}>
        <View style={[styles.row, compact && styles.rowCompact]}>
          <View style={styles.timeCol}>
            <Text style={styles.time}>{item.startTime}</Text>
            <Text style={styles.duration}>{item.durationMin}m</Text>
          </View>
          {!compact ? (
            <Image source={item.image} style={styles.thumb} />
          ) : null}
          <View style={styles.body}>
            <View style={styles.top}>
              <Tag label={item.discipline} tone={tone} />
              <Text style={styles.level}>{item.level}</Text>
            </View>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name="person-outline" size={13} color={colors.textFaint} />
              <Text style={styles.meta}>{item.coach}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </View>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  rowCompact: { paddingVertical: spacing.md },
  timeCol: { width: 52, alignItems: 'flex-start' },
  time: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.text, letterSpacing: 0.2 },
  duration: { fontFamily: fonts.medium, fontSize: 11, color: colors.textFaint, marginTop: 2 },
  thumb: { width: 56, height: 56, borderRadius: 14 },
  body: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  level: { fontFamily: fonts.medium, fontSize: 11, color: colors.textFaint },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginTop: 4, letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  meta: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
});
