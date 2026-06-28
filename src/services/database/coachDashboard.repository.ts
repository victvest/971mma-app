import { isClassLiveNow, isGymToday } from '@/core/time/gymTime';
import {
  getDemoCoachClasses,
  getDemoCoachDashboardStats,
} from '@/features/coach/demo/coachDemoFixtures';
import { isCoachDemoMode } from '@/features/coach/demo/coachDemoMode';
import { getSupabaseClient } from '@/services/supabase/client';
import { getCoachClasses, getCoachDashboardStats } from './coach.repository';
import type { ClassItem, CoachDashboardStats, CoachItem } from '@/types/domain';

export type CoachDashboardSummary = {
  stats: CoachDashboardStats;
  classes: ClassItem[];
};

type CoachDashboardRpcResponse = {
  stats?: CoachDashboardStats;
  classes?: ClassItem[];
};

function isMissingCoachDashboardRpc(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: unknown; message?: unknown };
  const code = typeof maybe.code === 'string' ? maybe.code : '';
  const message = typeof maybe.message === 'string' ? maybe.message : '';
  return code === 'PGRST202' || message.includes('get_coach_dashboard');
}

function normalizeCoachDashboardResponse(data: CoachDashboardRpcResponse): CoachDashboardSummary {
  return {
    stats: data.stats ?? {
      todayClassCount: 0,
      liveClassCount: 0,
      todayCheckIns: 0,
      promotionCandidateCount: 0,
    },
    classes: data.classes ?? [],
  };
}

async function getCoachDashboardViaRpc(coach: CoachItem): Promise<CoachDashboardSummary> {
  const { data, error } = await getSupabaseClient().rpc('get_coach_dashboard', {
    p_coach_id: coach.id,
  });

  if (error) throw error;
  return normalizeCoachDashboardResponse((data ?? {}) as CoachDashboardRpcResponse);
}

async function getCoachDashboardFallback(coach: CoachItem): Promise<CoachDashboardSummary> {
  const classes = await getCoachClasses(coach);
  const todayClasses = classes.filter((item) => isGymToday(item.startsAt));
  const liveClassCount = todayClasses.filter((item) =>
    isClassLiveNow(item.startsAt, item.durationMinutes),
  ).length;

  const stats = await getCoachDashboardStats(coach, classes);

  return {
    stats: {
      ...stats,
      todayClassCount: todayClasses.length,
      liveClassCount,
    },
    classes,
  };
}

export async function getCoachDashboardSummary(coach: CoachItem): Promise<CoachDashboardSummary> {
  if (isCoachDemoMode()) {
    return {
      stats: getDemoCoachDashboardStats(),
      classes: getDemoCoachClasses(),
    };
  }

  try {
    return await getCoachDashboardViaRpc(coach);
  } catch (error) {
    if (!isMissingCoachDashboardRpc(error)) throw error;
    return getCoachDashboardFallback(coach);
  }
}

export function selectTodayCoachClasses(classes: ClassItem[]): ClassItem[] {
  return classes.filter((item) => isGymToday(item.startsAt));
}
