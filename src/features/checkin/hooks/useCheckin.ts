import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/services/supabase/client';
import { invokeEdge } from '@/services/mindbody/edgeClient';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import { invalidateAfterMemberCheckin } from '@/lib/queryInvalidation';
import {
  ATTENDANCE_MIRROR_GC_MS,
  ATTENDANCE_MIRROR_STALE_MS,
  ATTENDANCE_STALE_MS,
  SECURE_QUERY_OPTIONS,
} from '@/lib/queryCachePolicy';
import type { CheckInRow } from '@/types/database';
import { useAuthStore } from '@/stores/useAuthStore';

import { ATTENDANCE_PAGE_SIZE } from '@/features/checkin/constants';

export const qrPassKey = (userId: string) => ['qr-token', userId] as const;
export const attendanceKey = (userId: string) => ['attendance', userId] as const;
export const attendanceRefreshKey = (userId: string) => ['attendance-refresh', userId] as const;

type QrPassResponse = { token: string; expiresAt: string };

export function useQrPass(passVisible = false) {
  const authUserId = useAuthStore((s) => s.user?.id);
  const activeMemberId = useActiveMemberId();
  const targetUserId = activeMemberId || authUserId;

  return useQuery({
    queryKey: qrPassKey(targetUserId ?? ''),
    queryFn: () =>
      invokeEdge<QrPassResponse>(
        'qr-issue',
        targetUserId && authUserId && targetUserId !== authUserId
          ? { targetUserId }
          : undefined,
      ),
    enabled: passVisible && Boolean(targetUserId),
    ...SECURE_QUERY_OPTIONS,
    refetchInterval: passVisible ? 60_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: passVisible,
  });
}

type CheckInBody = {
  token?: string;
  classId?: string;
  userId?: string;
  targetUserId?: string;
  confirmMinorPresent?: boolean;
};

type CheckInResponse = {
  success?: boolean;
  needsConfirmation?: boolean;
  memberName: string;
  memberId?: string;
  message?: string;
  checkedInAt?: string;
  checkInId?: string;
  guardianProxy?: boolean;
};

export function useCheckin() {
  const authUserId = useAuthStore((s) => s.user?.id ?? '');
  const activeMemberId = useActiveMemberId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CheckInBody) => {
      const payload = { ...input };
      if (
        !payload.token &&
        !payload.userId &&
        !payload.targetUserId &&
        activeMemberId &&
        activeMemberId !== authUserId
      ) {
        payload.targetUserId = activeMemberId;
      }
      return invokeEdge<CheckInResponse>('mb-checkin', payload);
    },
    onSuccess: (_data, variables) => {
      const memberId = variables.targetUserId ?? activeMemberId ?? authUserId;
      invalidateAfterMemberCheckin(queryClient, memberId, { classId: variables.classId });
    },
  });
}

type VisitsRefreshResponse = { refreshed: boolean; count: number };

async function fetchAttendancePage(userId: string, offset: number): Promise<CheckInRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('check_ins')
    .select(`
      id,
      user_id,
      class_id,
      checked_in_at,
      method,
      source,
      mindbody_visit_id,
      signed_in,
      missed,
      late_cancelled,
      classes:class_id (
        id,
        title,
        discipline,
        discipline_id,
        duration_minutes,
        coach_name,
        coach_id,
        disciplines:discipline_id (
          slug,
          display_name
        ),
        coaches:coach_id (
          name
        )
      )
    `)
    .eq('user_id', userId)
    .order('checked_in_at', { ascending: false })
    .range(offset, offset + ATTENDANCE_PAGE_SIZE - 1);

  if (error) throw error;
  return (data ?? []) as unknown as CheckInRow[];
}

export function useAttendanceRefresh(enabled = true) {
  const activeMemberId = useActiveMemberId();
  const authUserId = useAuthStore((s) => s.user?.id ?? '');
  const targetUserId = activeMemberId || authUserId;

  return useQuery({
    queryKey: attendanceRefreshKey(targetUserId),
    queryFn: () =>
      invokeEdge<VisitsRefreshResponse>(
        'mb-visits',
        targetUserId !== authUserId ? { targetUserId } : undefined,
      ),
    enabled: enabled && Boolean(targetUserId),
    staleTime: ATTENDANCE_MIRROR_STALE_MS,
    gcTime: ATTENDANCE_MIRROR_GC_MS,
  });
}

export function useAttendance() {
  const activeMemberId = useActiveMemberId();

  return useInfiniteQuery({
    queryKey: attendanceKey(activeMemberId),
    queryFn: ({ pageParam }) => fetchAttendancePage(activeMemberId, pageParam),
    enabled: Boolean(activeMemberId),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.length < ATTENDANCE_PAGE_SIZE
        ? undefined
        : (lastPageParam as number) + ATTENDANCE_PAGE_SIZE,
    staleTime: ATTENDANCE_STALE_MS,
  });
}
