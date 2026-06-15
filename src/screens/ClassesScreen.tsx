import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, palette, radii, spacing, typography } from '../theme';
import { AcademyHeader } from '../components/AcademyHeader';
import { ScreenShell } from '../components/ScreenShell';
import { ClassCard } from '../components/ClassCard';
import { Chip } from '../components/Chip';
import { GymClass } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import {
  DisciplineFilter,
  disciplineFilters,
  disciplineMatches,
} from '../data/classPresentation';
import { useClasses } from '../hooks/useClasses';

type Range = 'today' | 'week';

function firstName(email?: string | null, full?: string) {
  if (full) return full.split(' ')[0];
  if (!email) return 'Athlete';
  const handle = email.split('@')[0];
  return handle.charAt(0).toUpperCase() + handle.slice(1);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function ClassesScreen() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { classes, loading, refresh } = useClasses();
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

  const displayName =
    profile?.fullName || (user?.user_metadata as any)?.full_name || user?.email?.split('@')[0] || 'Member';

  return (
    <ScreenShell>
      <StatusBar style="dark" />
      <AcademyHeader memberName={firstName(user?.email, displayName)} initials={initials(displayName)} />

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
            <Chip key={d.value} label={d.label} active={filter === d.value} onPress={() => setFilter(d.value)} />
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : grouped.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No {filter === 'All' ? '' : filter.toLowerCase() + ' '}classes in this range.</Text>
          </View>
        ) : (
          grouped.map(([day, items]) => (
            <View key={day} style={styles.group}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>{day}</Text>
                <Text style={styles.dayCount}>{items.length} sessions</Text>
              </View>
              <View style={{ gap: spacing.sm }}>
                {items.map((c) => (
                  <ClassCard key={c.id} item={c} />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenShell>
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
          style={styles.segFill}
        >
          <Text style={[styles.segText, { color: '#fff' }]}>{label}</Text>
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
  scroll: { paddingTop: spacing.md, paddingBottom: 132 },

  segment: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    backgroundColor: palette.inset,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    padding: 4,
    gap: 4,
  },
  segBtn: { flex: 1 },
  segFill: { height: 40, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  segIdle: { height: 40, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: fonts.semi, fontSize: 14 },

  chipScroller: { marginTop: spacing.lg },
  chips: { paddingHorizontal: spacing.xl, gap: spacing.sm },

  group: { marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dayTitle: { ...typography.h2, color: colors.text },
  dayCount: { fontFamily: fonts.medium, fontSize: 13, color: colors.textFaint },

  empty: { paddingTop: spacing.huge, alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textMuted },
});
