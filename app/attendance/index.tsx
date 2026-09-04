import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { AttendanceRow } from '@/features/checkin/components/AttendanceRow';
import { AttendanceMonthHeader } from '@/features/attendance/components/AttendanceMonthHeader';
import { ClassSessionAttendanceRow } from '@/features/attendance/components/ClassSessionAttendanceRow';
import {
  useAttendanceHistory,
  type AttendanceHistoryTab,
  type GateListItem,
  type UnifiedClassAttendanceItem,
} from '@/features/attendance/hooks/useAttendanceHistory';
import type { AttendanceListEntry } from '@/features/attendance/utils/groupAttendanceByMonth';
import { AppBar, FlashListScrollComponent } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import {
  FLASH_LIST_ESTIMATES,
} from '@/shared/constants/flashListEstimates';
import { triggerLightImpact } from '@/shared/haptics';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { useTheme } from '@/shared/theme';
import { toUserFacingErrorMessage, USER_FACING_LOAD_ERROR } from '@/lib/userFacingError';
import { PillSegmentedTabs } from '@/shared/components/ui/PillSegmentedTabs';
import {
  isOfflineWithoutCache,
  isQueryActivelyLoading,
  OFFLINE_MESSAGE,
  OFFLINE_TITLE,
} from '@/lib/offlineState';

type ListItem = GateListItem | UnifiedClassAttendanceItem;

export default function AttendanceHistoryScreen() {
  const { colors, inset } = useTheme();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<AttendanceHistoryTab>(
    params.tab === 'classes' ? 'classes' : 'gate',
  );
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (params.tab === 'classes' || params.tab === 'gate') {
      setActiveTab(params.tab);
    }
  }, [params.tab]);

  const { isOnline, networkStatusKnown } = useNetworkStatus();
  const history = useAttendanceHistory(activeTab);

  const handleRefresh = useCallback(async () => {
    triggerLightImpact();
    setRefreshing(true);
    try {
      await history.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [history]);

  const renderItem = useCallback(
    ({ item }: { item: AttendanceListEntry<ListItem> }) => {
      if (item.kind === 'month') {
        return <AttendanceMonthHeader label={item.label} />;
      }

      const row = item.item;
      if ('rawItem' in row && 'type' in row && row.type === 'roll_call') {
        return <ClassSessionAttendanceRow item={row.rawItem} />;
      }
      if ('rawItem' in row && 'type' in row && row.type === 'check_in') {
        return <AttendanceRow item={row.rawItem} />;
      }
      // Gate list item
      if ('rawItem' in row) {
        return <AttendanceRow item={(row as GateListItem).rawItem} />;
      }
      return null;
    },
    [],
  );

  const getItemType = useCallback((item: AttendanceListEntry<ListItem>) => item.kind, []);

  const hasError = !!history.error;
  const hasData = history.hasData;
  const isInitialLoading =
    isQueryActivelyLoading(history.isLoading, history.isFetching) && !hasData;
  const isOfflineBlocked = isOfflineWithoutCache({
    networkStatusKnown,
    isOnline,
    hasData,
    hasError,
  });
  const errorMessage = toUserFacingErrorMessage(history.error, {
    fallback: USER_FACING_LOAD_ERROR,
  });

  const tabOptions = useMemo(
    () => [
      { value: 'gate' as const, label: 'Gate', accessibilityLabel: 'Gate visits' },
      { value: 'classes' as const, label: 'Classes', accessibilityLabel: 'Class attendance' },
    ],
    [],
  );

  const listHeader =
    history.softError && hasData ? (
      <View style={{ marginBottom: inset.md }}>
        <StateBlock
          kind="error"
          title="Sync issue"
          message={
            activeTab === 'gate'
              ? 'Could not refresh history.'
              : 'Could not refresh class attendance.'
          }
          actionLabel="Retry"
          onAction={() => void history.refetch()}
        />
      </View>
    ) : null;

  const emptyTitle =
    activeTab === 'gate' ? 'No gym visits yet' : 'No class attendance yet';
  const emptyMessage =
    activeTab === 'gate'
      ? 'When you check in at the academy, your visit history appears here.'
      : 'Class visits from roll call and synced Mindbody classes appear here.';

  return (
    <AppSafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar title="Attendance history" />

      <View style={{ paddingHorizontal: inset.lg, paddingVertical: inset.sm }}>
        <PillSegmentedTabs
          value={activeTab}
          options={tabOptions}
          onValueChange={setActiveTab}
          selectedVariant="accent"
        />
      </View>

      {isOfflineBlocked ? (
        <StateBlock
          kind="error"
          title={OFFLINE_TITLE}
          message={OFFLINE_MESSAGE}
          actionLabel="Retry"
          onAction={() => void history.refetch()}
          offlineAwareRetry
        />
      ) : isInitialLoading ? (
        <StateBlock
          kind="loading"
          title={activeTab === 'gate' ? 'Loading gym visits' : 'Loading class attendance'}
        />
      ) : hasError && !hasData ? (
        <StateBlock
          kind="error"
          title={
            activeTab === 'gate' ? 'Could not load history' : 'Could not load class attendance'
          }
          message={errorMessage}
          actionLabel="Retry"
          onAction={() => void history.refetch()}
          offlineAwareRetry
        />
      ) : !hasError && !hasData ? (
        <StateBlock kind="empty" title={emptyTitle} message={emptyMessage} />
      ) : (
        <FlashList
          renderScrollComponent={FlashListScrollComponent}
          data={history.list}
          getItemType={getItemType}
          overrideItemLayout={(layout, item) => {
            (layout as { size?: number }).size =
              item.kind === 'month'
                ? FLASH_LIST_ESTIMATES.attendanceMonthHeader
                : FLASH_LIST_ESTIMATES.attendanceRow;
          }}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{ paddingHorizontal: inset.lg, paddingBottom: inset.lg }}
          ItemSeparatorComponent={AttendanceListSeparator}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent.default}
              colors={[colors.accent.default]}
            />
          }
          onEndReached={() => {
            if (history.hasNextPage && !history.isFetchingNextPage) {
              history.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            history.isFetchingNextPage ? (
              <ActivityIndicator style={styles.footerLoader} color={colors.accent.default} />
            ) : null
          }
        />
      )}
    </AppSafeAreaView>
  );
}

function AttendanceListSeparator({
  leadingItem,
}: {
  leadingItem: AttendanceListEntry<ListItem> | null;
}) {
  if (!leadingItem || leadingItem.kind === 'month') {
    return null;
  }
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  footerLoader: { marginVertical: 20 },
  separator: { height: 10 },
});
