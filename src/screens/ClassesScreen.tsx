import React, { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors, radii, shadow, spacing, typography } from '../theme';
import { AppHeader } from '../components/AppHeader';
import { ClassCard } from '../components/ClassCard';
import { Chip } from '../components/Chip';
import { GymClass } from '../data/mockData';
import {
  DisciplineFilter,
  disciplineFilters,
  disciplineMatches,
} from '../data/classPresentation';
import { useClasses } from '../hooks/useClasses';

type Range = 'today' | 'week';

export function ClassesScreen() {
  const { classes, loading, busyId, usingMock, book, cancel, refresh } = useClasses();
  const [range, setRange] = useState<Range>('week');
  const [filter, setFilter] = useState<DisciplineFilter>('All');

  const filtered = useMemo(() => {
    return classes.filter((c) => {
      const inRange = range === 'week' ? true : c.day === 'Today';
      return inRange && disciplineMatches(c.discipline, filter);
    });
  }, [classes, range, filter]);

  const grouped = useMemo(() => {
    const map: Record<string, GymClass[]> = {};
    filtered.forEach((c) => {
      (map[c.day] = map[c.day] || []).push(c);
    });
    return Object.entries(map);
  }, [filtered]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AppHeader title="Schedule" subtitle="Book your mat time" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.accent} />}
      >
        <View style={styles.segment}>
          <SegBtn label="Today" active={range === 'today'} onPress={() => setRange('today')} />
          <SegBtn label="This week" active={range === 'week'} onPress={() => setRange('week')} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipScroller}
        >
          {disciplineFilters.map((d) => (
            <Chip
              key={d.value}
              label={d.label}
              active={filter === d.value}
              onPress={() => setFilter(d.value)}
            />
          ))}
        </ScrollView>

        {usingMock ? (
          <View style={styles.demoBanner}>
            <Text style={styles.demoText}>Showing sample schedule</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : grouped.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No {filter} classes in this range.</Text>
          </View>
        ) : (
          grouped.map(([day, items]) => (
            <View key={day} style={styles.group}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>{day}</Text>
                <Text style={styles.dayCount}>{items.length} classes</Text>
              </View>
              <View style={{ gap: spacing.md }}>
                {items.map((c) => (
                  <ClassCard
                    key={c.id}
                    item={c}
                    busy={busyId === c.id}
                    onBook={() => book(c.id)}
                    onCancel={() => cancel(c.id)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function SegBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text
      onPress={onPress}
      style={[styles.segBtn, active && styles.segBtnActive]}
      suppressHighlighting
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingTop: spacing.xl, paddingBottom: 120 },

  segment: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radii.pill,
    padding: 4,
  },
  segBtn: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 11,
    borderRadius: radii.pill,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    overflow: 'hidden',
  },
  segBtnActive: { backgroundColor: colors.accent, color: '#fff', ...shadow.soft },

  chipScroller: { marginTop: spacing.lg },
  chips: { paddingHorizontal: spacing.xl, gap: spacing.sm },

  demoBanner: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  demoText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },

  group: { marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dayTitle: { ...typography.h2, color: colors.text },
  dayCount: { fontSize: 13, color: colors.textFaint, fontWeight: '700' },

  empty: { paddingTop: spacing.huge, alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textMuted },
});
