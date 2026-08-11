import { useMemo } from 'react';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { useAttendance } from '@/features/checkin/hooks/useCheckin';
import { useClassSessionAttendance } from '@/features/attendance/hooks/useClassSessionAttendance';
import { isFacilityCheckIn } from '@/features/attendance/utils/classifyCheckIn';
import {
  groupAttendanceByMonth,
  type AttendanceListEntry,
} from '@/features/attendance/utils/groupAttendanceByMonth';
import {
  unifyClassAttendance,
  type UnifiedClassAttendanceItem,
} from '@/features/attendance/utils/unifyClassAttendance';
import type { CheckInRow } from '@/types/database';
import type { ClassSessionAttendanceRow } from '@/services/database/classAttendance.repository';

export type AttendanceHistoryTab = 'gate' | 'classes';

type GateListItem = { id: string; timestamp: string; rawItem: CheckInRow };

function flattenPages<T>(query: UseInfiniteQueryResult<InfiniteData<T[], unknown>, Error>): T[] {
  return query.data?.pages.flat() ?? [];
}

/**
 * Owns both attendance queries and returns tab-ready, deduped, month-grouped lists.
 * Screen stays presentational.
 */
export function useAttendanceHistory(activeTab: AttendanceHistoryTab) {
  const attendanceQuery = useAttendance();
  const classAttendanceQuery = useClassSessionAttendance();

  const checkIns = useMemo(
    () => flattenPages(attendanceQuery),
    [attendanceQuery.data],
  );
  const classRows = useMemo(
    () => flattenPages(classAttendanceQuery),
    [classAttendanceQuery.data],
  );

  const gateItems = useMemo((): GateListItem[] => {
    return checkIns.filter(isFacilityCheckIn).map((item) => ({
      id: item.id,
      timestamp: item.checked_in_at,
      rawItem: item,
    }));
  }, [checkIns]);

  const classItems = useMemo(
    () => unifyClassAttendance(checkIns, classRows),
    [checkIns, classRows],
  );

  const gateList = useMemo(() => groupAttendanceByMonth(gateItems), [gateItems]);
  const classList = useMemo(() => groupAttendanceByMonth(classItems), [classItems]);

  const isGate = activeTab === 'gate';
  const list: AttendanceListEntry<GateListItem | UnifiedClassAttendanceItem>[] = isGate
    ? gateList
    : classList;

  // Classes tab depends on BOTH sources; Gate only needs check_ins.
  const secondaryNeeded = !isGate;
  const hasData = isGate ? gateItems.length > 0 : classItems.length > 0;

  const isFetching =
    attendanceQuery.isFetching || (secondaryNeeded && classAttendanceQuery.isFetching);
  const isLoading =
    (attendanceQuery.isLoading && !attendanceQuery.data) ||
    (secondaryNeeded && classAttendanceQuery.isLoading && !classAttendanceQuery.data);

  const hardError = isGate
    ? attendanceQuery.error
    : (!hasData && (attendanceQuery.error || classAttendanceQuery.error)
        ? (attendanceQuery.error ?? classAttendanceQuery.error)
        : null);

  const softError =
    hasData && (attendanceQuery.error || (secondaryNeeded && classAttendanceQuery.error))
      ? (attendanceQuery.error ?? classAttendanceQuery.error)
      : null;

  const hasNextPage = isGate
    ? Boolean(attendanceQuery.hasNextPage)
    : Boolean(attendanceQuery.hasNextPage || classAttendanceQuery.hasNextPage);

  const isFetchingNextPage = isGate
    ? attendanceQuery.isFetchingNextPage
    : attendanceQuery.isFetchingNextPage || classAttendanceQuery.isFetchingNextPage;

  const fetchNextPage = () => {
    if (isGate) {
      if (attendanceQuery.hasNextPage && !attendanceQuery.isFetchingNextPage) {
        void attendanceQuery.fetchNextPage();
      }
      return;
    }
    if (classAttendanceQuery.hasNextPage && !classAttendanceQuery.isFetchingNextPage) {
      void classAttendanceQuery.fetchNextPage();
    }
    if (attendanceQuery.hasNextPage && !attendanceQuery.isFetchingNextPage) {
      void attendanceQuery.fetchNextPage();
    }
  };

  const refetch = async () => {
    if (isGate) {
      await attendanceQuery.refetch();
      return;
    }
    await Promise.all([attendanceQuery.refetch(), classAttendanceQuery.refetch()]);
  };

  return {
    list,
    gateCount: gateItems.length,
    classCount: classItems.length,
    hasData,
    isLoading,
    isFetching,
    error: hardError,
    softError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
    attendanceQuery,
    classAttendanceQuery,
  };
}

export type { GateListItem, UnifiedClassAttendanceItem, ClassSessionAttendanceRow };
