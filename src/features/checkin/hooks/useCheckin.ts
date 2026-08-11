import { useEffect, useRef } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/services/supabase/client';
import { invokeEdge } from '@/services/mindbody/edgeClient';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import {
  ATTENDANCE_MIRROR_GC_MS,
  ATTENDANCE_MIRROR_STALE_MS,
  ATTENDANCE_STALE_MS,
  SECURE_QUERY_OPTIONS,
} from '@/lib/queryCachePolicy';
import { invalidateAfterMemberCheckin } from '@/lib/queryInvalidation';
import type { CheckInRow } from '@/types/database';
import { useAuthStore } from '@/stores/useAuthStore';
import { qrPassRefetchIntervalMs } from '@/features/checkin/utils/qrPassLifecycle';
import { parseMemberQrToken } from '@/services/qr/token';

import { ATTENDANCE_PAGE_SIZE } from '@/features/checkin/constants';

/** How often to poll `qr_tokens.consumed_at` while the pass is on screen. */
const QR_CONSUMED_POLL_MS = 3_000;

/**
 * Gate consumes the QR *before* inserting today's `check_ins` row. A second
 * invalidate shortly after covers that race (and streak trigger lag).
 */
const POST_GATE_REFRESH_RETRY_MS = 1_200;

export const qrPassKey = (userId: string) => ['qr-token', userId] as const;
export const attendanceKey = (userId: string) => ['attendance', userId] as const;
export const attendanceRefreshKey = (userId: string) => ['attendance-refresh', userId] as const;

type QrPassResponse = { token: string; expiresAt: string };

/**
 * After the gate (or coach) consumes a jti:
 * 1. Mint a fresh pass so the member never presents a spent QR
 * 2. Refresh attendance / streak / home caches so Check-in UI updates without pull-to-refresh
 *
 * Uses existing RLS on `qr_tokens` — no SALTO API changes.
 */
function useRefreshQrWhenConsumed(
  passVisible: boolean,
  targetUserId: string | undefined,
  token: string | null | undefined,
) {
  const queryClient = useQueryClient();
  const jti = token ? (parseMemberQrToken(token)?.jti ?? null) : null;
  const refreshedForJtiRef = useRef<string | null>(null);
  const postGateRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const consumedQuery = useQuery({
    queryKey: ['qr-token-consumed', targetUserId ?? '', jti ?? ''],
    queryFn: async () => {
      if (!jti || !targetUserId) return null;
      const { data, error } = await getSupabaseClient()
        .from('qr_tokens')
        .select('consumed_at')
        .eq('jti', jti)
        .eq('user_id', targetUserId)
        .maybeSingle();
      if (error) throw error;
      return data?.consumed_at ?? null;
    },
    enabled: passVisible && Boolean(targetUserId && jti),
    staleTime: 0,
    refetchInterval: passVisible && jti ? QR_CONSUMED_POLL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: passVisible,
  });

  useEffect(() => {
    return () => {
      if (postGateRetryRef.current) {
        clearTimeout(postGateRetryRef.current);
        postGateRetryRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!jti) {
      refreshedForJtiRef.current = null;
      return;
    }
    if (!consumedQuery.data || !targetUserId) return;
    if (refreshedForJtiRef.current === jti) return;
    refreshedForJtiRef.current = jti;

    // Refresh member UI first — gate writes check_in after consuming the jti.
    invalidateAfterMemberCheckin(queryClient, targetUserId);
    if (postGateRetryRef.current) clearTimeout(postGateRetryRef.current);
    postGateRetryRef.current = setTimeout(() => {
      postGateRetryRef.current = null;
      invalidateAfterMemberCheckin(queryClient, targetUserId);
    }, POST_GATE_REFRESH_RETRY_MS);

    // Remint last: a new jti must not cancel the post-gate attendance refresh.
    void queryClient.invalidateQueries({ queryKey: qrPassKey(targetUserId) });
  }, [consumedQuery.data, jti, queryClient, targetUserId]);
}

export function useQrPass(passVisible = false) {
  const authUserId = useAuthStore((s) => s.user?.id);
  const activeMemberId = useActiveMemberId();
  const targetUserId = activeMemberId || authUserId;

  const passQuery = useQuery({
    queryKey: qrPassKey(targetUserId ?? ''),
    queryFn: () =>
      invokeEdge<QrPassResponse>(
        'qr-issue',
        targetUserId && authUserId && targetUserId !== authUserId ? { targetUserId } : undefined,
      ),
    enabled: passVisible && Boolean(targetUserId),
    ...SECURE_QUERY_OPTIONS,
    refetchInterval: (query) =>
      passVisible ? qrPassRefetchIntervalMs(query.state.data?.expiresAt) : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: passVisible,
  });

  useRefreshQrWhenConsumed(passVisible, targetUserId, passQuery.data?.token);

  return passQuery;
}

type VisitsRefreshResponse = { refreshed: boolean; count: number };

async function fetchAttendancePage(userId: string, offset: number): Promise<CheckInRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('check_ins')
    .select(
      `
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
      raw_payload,
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
    `,
    )
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
