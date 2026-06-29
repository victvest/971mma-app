import { isClassLiveNow, isGymToday } from '@/core/time/gymTime';
import {
  getDemoClassRoster,
  getDemoCoachClassById,
  getDemoCoachClasses,
  getDemoCoachDashboardStats,
  DEMO_PROMOTION_CANDIDATES,
} from '@/features/coach/demo/coachDemoFixtures';
import { isCoachDemoMode } from '@/features/coach/demo/coachDemoMode';
import { getSupabaseClient } from '@/services/supabase/client';
import { invokeEdge } from '@/services/mindbody/edgeClient';
import { getClassById, getClassesByCoach } from '@/services/database/classes.repository';
import { getCoachAssignedDisciplines } from '@/services/database/coachMemberNotes.repository';
import type {
  ClassItem,
  ClassRosterResponse,
  CoachDashboardStats,
  CoachItem,
  PromotionCandidateItem,
} from '@/types/domain';

const rosterInflightRequests = new Map<string, Promise<ClassRosterResponse>>();

async function filterCoachClassesByAssignedDisciplines(
  coach: CoachItem,
  classes: ClassItem[],
): Promise<ClassItem[]> {
  const assigned = await getCoachAssignedDisciplines(coach.id);
  if (assigned.length === 0) return classes;

  const allowed = new Set(assigned.map((item) => item.id));
  return classes.filter((item) => !item.disciplineId || allowed.has(item.disciplineId));
}

export async function assertCoachClassAccess(classId: string): Promise<void> {
  if (isCoachDemoMode()) return;

  const { error } = await getSupabaseClient().rpc('assert_coach_class_access', {
    p_class_id: classId,
  });
  if (error) throw error;
}

export async function getCoachClasses(coach: CoachItem): Promise<ClassItem[]> {
  if (isCoachDemoMode()) {
    return getDemoCoachClasses();
  }
  const classes = await getClassesByCoach(coach);
  return filterCoachClassesByAssignedDisciplines(coach, classes);
}

export async function getCoachClassById(classId: string): Promise<ClassItem | null> {
  if (isCoachDemoMode()) {
    return getDemoCoachClassById(classId);
  }

  const item = await getClassById(classId);
  if (!item) return null;

  await assertCoachClassAccess(classId);
  return item;
}

export async function fetchClassRoster(
  classId: string,
  options: { force?: boolean } = {},
): Promise<ClassRosterResponse> {
  if (isCoachDemoMode()) {
    void options.force;
    return getDemoClassRoster(classId);
  }

  const cacheKey = `${classId}:${options.force ? 'force' : 'default'}`;
  if (!options.force) {
    const inflight = rosterInflightRequests.get(cacheKey);
    if (inflight) return inflight;
  }

  const request = invokeEdge<ClassRosterResponse>('mb-class-roster', {
    classId,
    force: options.force ?? false,
  }).finally(() => {
    rosterInflightRequests.delete(cacheKey);
  });

  if (!options.force) {
    rosterInflightRequests.set(cacheKey, request);
  }

  return request;
}

export function computeClassRosterAttendance(visitors: ClassRosterResponse['visitors']): {
  checkedIn: number;
  missing: number;
} {
  let checkedIn = 0;
  let missing = 0;

  for (const visitor of visitors) {
    const attended = visitor.checkedInLocally || visitor.signedInMindbody;
    if (attended) {
      checkedIn += 1;
    } else {
      missing += 1;
    }
  }

  return { checkedIn, missing };
}

export async function listPromotionCandidates(
  discipline: 'bjj' | 'wrestling',
): Promise<PromotionCandidateItem[]> {
  if (isCoachDemoMode()) {
    if (discipline !== 'bjj') return [];
    return DEMO_PROMOTION_CANDIDATES.map((item) => ({ ...item }));
  }
  const { data, error } = await getSupabaseClient().rpc('list_promotion_candidates', {
    p_discipline: discipline,
  });
  if (error) throw error;

  return ((data ?? []) as Array<{
    user_id: string;
    full_name: string;
    email: string;
    belt_rank: string | null;
    belt_stripes: number;
    percent: number;
    training_days: number;
    recent_check_ins: number;
    candidate_reason: PromotionCandidateItem['candidateReason'];
  }>).map((row) => ({
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    beltRank: row.belt_rank,
    beltStripes: row.belt_stripes ?? 0,
    percent: Number(row.percent),
    trainingDays: row.training_days,
    recentCheckIns: row.recent_check_ins,
    candidateReason: row.candidate_reason,
  }));
}

export async function getCoachDashboardStats(
  coach: CoachItem,
  classes?: ClassItem[],
): Promise<CoachDashboardStats> {
  if (isCoachDemoMode()) {
    void coach;
    void classes;
    return getDemoCoachDashboardStats();
  }

  const resolvedClasses = classes ?? (await getCoachClasses(coach));
  const todayClasses = resolvedClasses.filter((item) => isGymToday(item.startsAt));
  const liveClassCount = todayClasses.filter((item) =>
    isClassLiveNow(item.startsAt, item.durationMinutes),
  ).length;

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
  const start = new Date(`${today}T00:00:00+04:00`).toISOString();
  const end = new Date(`${today}T23:59:59.999+04:00`).toISOString();

  const { count, error } = await getSupabaseClient()
    .from('check_ins')
    .select('id', { count: 'exact', head: true })
    .gte('checked_in_at', start)
    .lte('checked_in_at', end);

  if (error) throw error;

  const candidates = await listPromotionCandidates('bjj');
  const promotionCandidateCount = candidates.filter(
    (item) => item.candidateReason !== 'tracking',
  ).length;

  return {
    todayClassCount: todayClasses.length,
    liveClassCount,
    todayCheckIns: count ?? 0,
    promotionCandidateCount,
  };
}

export function pickCurrentCoachClass(classes: ClassItem[]): ClassItem | null {
  const todayClasses = classes.filter((item) => isGymToday(item.startsAt));
  const live = todayClasses.find((item) => isClassLiveNow(item.startsAt, item.durationMinutes));
  if (live) return live;

  const now = Date.now();
  const upcomingToday = todayClasses
    .filter((item) => new Date(item.startsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  if (upcomingToday[0]) return upcomingToday[0];

  return (
    classes
      .filter((item) => new Date(item.startsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] ?? null
  );
}
