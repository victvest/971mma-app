import React, { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AttendanceRow } from '@/features/checkin/components/AttendanceRow';
import { RECENT_ATTENDANCE_PREVIEW } from '@/features/checkin/constants';
import { useTheme } from '@/shared/theme';
import type { CheckInRow } from '@/types/database';

type Props = {
  items: CheckInRow[];
  loading: boolean;
  syncing: boolean;
  totalHint?: number;
};

export const RecentAttendanceSection = memo(function RecentAttendanceSection({
  items,
  loading,
  syncing,
  totalHint,
}: Props) {
  const { colors, typography, inset, gap } = useTheme();
  const router = useRouter();
  const preview = items.slice(0, RECENT_ATTENDANCE_PREVIEW);
  const showViewAll = items.length > 0;

  return (
    <View style={[styles.section, { gap: gap.md }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[typography.textPresets.metricLabel, { color: colors.text.tertiary }]}>
            Recent visits
          </Text>
          {totalHint !== undefined && totalHint > 0 ? (
            <Text style={[styles.countLabel, { color: colors.text.tertiary }]}>
              {totalHint} total
            </Text>
          ) : null}
        </View>
        {showViewAll ? (
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/attendance/class-sessions')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.viewAllBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[typography.textPresets.buttonSmall, { color: colors.accent.default }]}>
                Classes
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/attendance')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.viewAllBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[typography.textPresets.buttonSmall, { color: colors.accent.default }]}>
                View all
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.accent.default} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent.default} />
        </View>
      ) : preview.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            {
              borderRadius: 16,
              backgroundColor: colors.background.secondary,
              padding: inset.lg,
            },
          ]}
        >
          <Ionicons name="footsteps-outline" size={28} color={colors.text.tertiary} />
          <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
            No visits yet
          </Text>
          <Text style={[styles.emptyMessage, { color: colors.text.secondary }]}>
            {syncing ? 'Syncing your gym history…' : 'Your check-ins will appear here after your first visit.'}
          </Text>
        </View>
      ) : (
        <View style={{ gap: gap.sm }}>
          {preview.map((item) => (
            <AttendanceRow key={item.id} item={item} compact />
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  section: {},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerText: {
    gap: 2,
  },
  countLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingLeft: 8,
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
  },
  emptyMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
