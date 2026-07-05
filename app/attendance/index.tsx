import React, { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { AttendanceRow } from '@/features/checkin/components/AttendanceRow';
import { useAttendance } from '@/features/checkin/hooks/useCheckin';
import { AppBar, FlashListScrollComponent } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { FLASH_LIST_ESTIMATES, flashListOverrideItemLayout } from '@/shared/constants/flashListEstimates';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { useTheme } from '@/shared/theme';
import {
  isOfflineWithoutCache,
  isQueryActivelyLoading,
  OFFLINE_MESSAGE,
  OFFLINE_TITLE,
} from '@/lib/offlineState';
import type { CheckInRow } from '@/types/database';

export default function AttendanceHistoryScreen() {
  const { colors, inset, typography } = useTheme();
  const router = useRouter();
  const attendanceQuery = useAttendance();
  const checkIns = attendanceQuery.data?.pages.flat() ?? [];
  const { isOnline, networkStatusKnown } = useNetworkStatus();

  const renderItem = useCallback(
    ({ item }: { item: CheckInRow }) => <AttendanceRow item={item} />,
    [],
  );

  const hasError = !!attendanceQuery.error;
  const hasData = checkIns.length > 0;
  const isInitialLoading =
    isQueryActivelyLoading(attendanceQuery.isLoading, attendanceQuery.isFetching) && !hasData;
  const isOfflineBlocked = isOfflineWithoutCache({
    networkStatusKnown,
    isOnline,
    hasData,
    hasError,
  });
  const errorMessage = attendanceQuery.error instanceof Error ? attendanceQuery.error.message : 'Please check your connection.';

  const listHeader = (
    <View style={{ marginBottom: inset.md, gap: inset.sm }}>
      <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
        Visits synced when you check in at the academy. Training streaks use these records.
      </Text>
      {hasError && hasData ? (
        <StateBlock
          kind="error"
          title="Sync issue"
          message="Could not refresh history."
          actionLabel="Retry"
          onAction={() => attendanceQuery.refetch()}
        />
      ) : null}
      <Pressable
        onPress={() => router.push('/attendance/class-sessions')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
          Class roll call
        </Text>
        <Text style={[typography.textPresets.buttonSmall, { color: colors.accent.default }]}>
          View all
        </Text>
      </Pressable>
    </View>
  );

  return (
    <AppSafeAreaView style={[styles.safe, { backgroundColor: colors.background.primary }]} edges={['top', 'bottom']}>
      <AppBar title="Gym visits" />

      {isOfflineBlocked ? (
        <StateBlock
          kind="error"
          title={OFFLINE_TITLE}
          message={OFFLINE_MESSAGE}
          actionLabel="Retry"
          onAction={() => attendanceQuery.refetch()}
          offlineAwareRetry
        />
      ) : isInitialLoading ? (
        <StateBlock kind="loading" title="Loading gym visits" />
      ) : hasError && !hasData ? (
        <StateBlock
          kind="error"
          title="Could not load history"
          message={errorMessage}
          actionLabel="Retry"
          onAction={() => attendanceQuery.refetch()}
          offlineAwareRetry
        />
      ) : !hasError && checkIns.length === 0 ? (
        <StateBlock
          kind="empty"
          title="No gym visits yet"
          message="When you check in at the academy, your visit history appears here. For per-class roll call (present/absent), see Class attendance."
        />
      ) : (
        <FlashList
          renderScrollComponent={FlashListScrollComponent}
          data={checkIns}
          overrideItemLayout={flashListOverrideItemLayout(FLASH_LIST_ESTIMATES.attendanceRow)}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{ padding: inset.lg, paddingTop: 12 }}
          ItemSeparatorComponent={AttendanceSeparator}
          onEndReached={() => {
            if (attendanceQuery.hasNextPage && !attendanceQuery.isFetchingNextPage) {
              void attendanceQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            attendanceQuery.isFetchingNextPage ? (
              <ActivityIndicator style={styles.footerLoader} color={colors.accent.default} />
            ) : null
          }
        />
      )}
    </AppSafeAreaView>
  );
}

function AttendanceSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLoader: { marginVertical: 20 },
  separator: { height: 10 },
});
