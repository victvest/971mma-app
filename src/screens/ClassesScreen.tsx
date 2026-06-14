import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, glow, palette, radii, spacing, typography } from '../theme';
import { AppHeader } from '../components/AppHeader';
import { AuroraBackground } from '../components/AuroraBackground';
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
      <AuroraBackground tone="red" />
      <AppHeader title="Schedule" subtitle="Book your mat time" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.accentBright} />}
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
            <Chip key={d.value} label={d.label} active={filter === d.value} onPress={() => setFilter(d.value)} />
          ))}
        </ScrollView>

        {usingMock ? (
          <View style={styles.demoBanner}>
            <Text style={styles.demoText}>Showing sample schedule</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.accentBright} />
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
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.segBtn}>
      {active ? (
        <LinearGradient
          colors={[palette.greenBright, palette.green]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.segFill, glow.green]}
        >
          <Text style={[styles.segText, { color: '#04150C' }]}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.segIdle}>
          <Text style={[styles.segText, { color: colors.textMuted }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.abyss },
  scroll: { paddingTop: spacing.md, paddingBottom: 132 },

  segment: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    backgroundColor: palette.glass06,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    padding: 5,
    gap: 5,
  },
  segBtn: { flex: 1 },
  segFill: { height: 42, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  segIdle: { height: 42, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: fonts.bold, fontSize: 14 },

  chipScroller: { marginTop: spacing.lg },
  chips: { paddingHorizontal: spacing.xl, gap: spacing.sm },

  demoBanner: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    backgroundColor: palette.glass06,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: 9,
    alignItems: 'center',
  },
  demoText: { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted },

  group: { marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dayTitle: { ...typography.h2, color: colors.text },
  dayCount: { fontFamily: fonts.bold, fontSize: 13, color: colors.textFaint },

  empty: { paddingTop: spacing.huge, alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textMuted },
});
