import { useInfiniteQuery } from '@tanstack/react-query';
import {
  CLASS_ATTENDANCE_PAGE_SIZE,
  fetchClassSessionAttendancePage,
} from '@/services/database/classAttendance.repository';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';

export const classSessionAttendanceKey = (userId: string) =>
  ['class-session-attendance', userId] as const;

export function useClassSessionAttendance() {
  const activeMemberId = useActiveMemberId();

  return useInfiniteQuery({
    queryKey: classSessionAttendanceKey(activeMemberId),
    queryFn: ({ pageParam }) => fetchClassSessionAttendancePage(activeMemberId, pageParam),
    enabled: Boolean(activeMemberId),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.length < CLASS_ATTENDANCE_PAGE_SIZE
        ? undefined
        : (lastPageParam as number) + CLASS_ATTENDANCE_PAGE_SIZE,
    staleTime: 60_000,
  });
}
