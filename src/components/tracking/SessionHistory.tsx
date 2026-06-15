import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, fonts, motion, palette, radii, spacing } from '../../theme';
import type { TrainingSession } from '../../data/memberFeatures';
import {
  disciplineFilters,
  filterSessions,
  groupSessions,
  type SessionGroup,
} from '../../utils/trainingHistory';
import { SessionTimeline } from './SessionTimeline';

type Props = {
  sessions: TrainingSession[];
};

/** Full session history — filters and month groups. */
export function SessionHistory({ sessions }: Props) {
  const [filter, setFilter] = useState<(typeof disciplineFilters)[number]>('All');

  const filtered = useMemo(
    () => filterSessions(sessions, filter),
    [filter, sessions],
  );
  const groups = useMemo(() => groupSessions(filtered), [filtered]);

  return (
    <View>
      <View style={styles.filters}>
        {disciplineFilters.map((chip) => {
          const active = chip === filter;
          return (
            <Pressable
              key={chip}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setFilter(chip);
              }}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip}</Text>
            </Pressable>
          );
        })}
      </View>

      {groups.length ? (
        groups.map((group, gi) => (
          <HistoryGroup key={group.key} group={group} groupIndex={gi} />
        ))
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptyText}>Check in at the gym to start building your training history.</Text>
        </View>
      )}
    </View>
  );
}

function HistoryGroup({ group, groupIndex }: { group: SessionGroup; groupIndex: number }) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: motion.duration.normal,
      delay: groupIndex * 80,
      easing: motion.easing.out,
      useNativeDriver: true,
    }).start();
  }, [fade, group.key, groupIndex]);

  return (
    <Animated.View style={{ opacity: fade, marginBottom: spacing.xl }}>
      <Text style={styles.groupTitle}>{group.title}</Text>
      <SessionTimeline sessions={group.sessions} startIndex={groupIndex * 3} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: palette.inset,
  },
  chipActive: {
    backgroundColor: palette.redGlass,
    borderColor: palette.redLine,
  },
  chipText: { fontFamily: fonts.semi, fontSize: 12, color: colors.textMuted },
  chipTextActive: { color: palette.red },
  groupTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },
  empty: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 21,
    paddingHorizontal: spacing.xl,
  },
});
