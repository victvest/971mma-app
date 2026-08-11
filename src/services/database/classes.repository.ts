import { gymRangeIso, isGymToday } from '@/core/time/gymTime';
import {
  getAcademyDemoClassById,
  getAcademyDemoClassesForCoach,
  getAcademyDemoScheduleClasses,
  isDemoAcademyClassId,
} from '@/features/coaches/demo/academyCoachScheduleFixtures';
import {
  selectClassesByCoach,
  selectScheduleCategories,
  selectSchedulePage,
} from '@/features/schedule/utils/scheduleDaySelectors';
import type { ScheduleCategory } from '@/features/schedule/utils/scheduleCategory';
import { isGymUsageClass } from '@/features/schedule/utils/classDisplay';
import { getSupabaseClient } from '@/services/supabase/client';
import type { ClassRow } from '@/types/database';
import type { ClassItem, CoachItem } from '@/types/domain';
import { getCoachById } from './coaches.repository';
import { mapClassRow } from './mappers';

const CLASS_COLUMNS =
  'id, title, discipline, discipline_id, description, coach_name, coach_id, starts_at, duration_minutes, capacity, level, image_url, mindbody_class_id, staff_mindbody_id, booked_count, is_available, is_waitlist_available, is_cancelled';

export const HOME_HERO_CLASS_LIMIT = 3;

/**
 * Member home carousel:
 * 1) Today's Gym Usage (live preferred, else soonest still-on today)
 * 2) Next live / upcoming non–Gym Usage classes
 * Never includes Gym Usage from other days.
 */
export function selectUpcomingHeroClasses(
  classes: ClassItem[],
  limit: number,
  now = Date.now(),
): ClassItem[] {
  const nowDate = new Date(now);
  const stillOn = (item: ClassItem) =>
    new Date(item.startsAt).getTime() + item.durationMinutes * 60_000 > now;

  const upcoming = classes
    .filter(stillOn)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const todayGymUsage = upcoming.filter(
    (item) => isGymUsageClass(item) && isGymToday(item.startsAt, nowDate),
  );
  const liveGym = todayGymUsage.find((item) => {
    const start = new Date(item.startsAt).getTime();
    return now >= start && now <= start + item.durationMinutes * 60_000;
  });
  const gymLead = liveGym ? [liveGym] : todayGymUsage[0] ? [todayGymUsage[0]] : [];
  const leadIds = new Set(gymLead.map((item) => item.id));

  // Fill remaining slots with real classes only — never other-day Gym Usage.
  const nextSessions = upcoming.filter(
    (item) => !leadIds.has(item.id) && !isGymUsageClass(item),
  );

  return [...gymLead, ...nextSessions].slice(0, limit);
}

/**
 * Member home hero only. Does not invent other-day Gym Usage fillers.
 * Schedule tab / coach mode use their own queries.
 */
export function resolveHomeHeroClasses(
  classes: ClassItem[],
  limit: number = HOME_HERO_CLASS_LIMIT,
  now = Date.now(),
): ClassItem[] {
  const upcoming = selectUpcomingHeroClasses(classes, limit, now);
  if (upcoming.length > 0) return upcoming;

  const demo = getAcademyDemoScheduleClasses(new Date(now));
  return selectUpcomingHeroClasses(demo, limit, now);
}

export type SchedulePageInput = {
  fromISO: string;
  toISO: string;
  category?: ScheduleCategory | null;
  limit: number;
  offset: number;
};

function buildScheduleDayQuery(fromISO: string, toISO: string) {
  return getSupabaseClient()
    .from('classes')
    .select(CLASS_COLUMNS)
    .not('mindbody_class_id', 'is', null)
    .gte('starts_at', fromISO)
    .lte('starts_at', toISO)
    .eq('is_cancelled', false)
    .order('starts_at', { ascending: true });
}

/** Single gym-day download used by schedule, categories, and local pagination. */
export async function fetchScheduleDayClasses(
  fromISO: string,
  toISO: string,
): Promise<ClassItem[]> {
  const { data, error } = await buildScheduleDayQuery(fromISO, toISO);
  if (error) throw error;
  const items = ((data ?? []) as ClassRow[]).map(mapClassRow);
  if (items.length > 0) {
    const hasUpcoming = items.some(
      (item) => new Date(item.startsAt).getTime() + item.durationMinutes * 60_000 > Date.now(),
    );
    if (hasUpcoming) return items;
  }
  if (__DEV__) {
    return getAcademyDemoScheduleClasses();
  }
  return items;
}

export async function fetchCoachDayClasses(
  coach: CoachItem,
  fromISO: string,
  toISO: string,
): Promise<ClassItem[]> {
  if (coach.mindbodyStaffId) {
    const { data, error } = await buildScheduleDayQuery(fromISO, toISO).eq(
      'staff_mindbody_id',
      coach.mindbodyStaffId,
    );
    if (error) throw error;
    const byStaff = ((data ?? []) as ClassRow[]).map(mapClassRow);
    if (byStaff.length > 0) return byStaff;
  }

  const day = await fetchScheduleDayClasses(fromISO, toISO);
  const matched = selectClassesByCoach(day, coach);
  if (matched.length > 0) return matched;

  if (__DEV__) {
    return getAcademyDemoClassesForCoach(coach);
  }
  return [];
}

/** Next non-cancelled Mindbody classes for the member home hero (RPC fallback). */
export async function fetchUpcomingHeroClasses(
  limit: number,
  _userId?: string,
): Promise<ClassItem[]> {
  const { fromISO, toISO } = gymRangeIso();
  const now = Date.now();

  // Academy-wide today/tomorrow pool — Gym Usage is pinned client-side.
  const { data, error } = await getSupabaseClient()
    .from('classes')
    .select(CLASS_COLUMNS)
    .not('mindbody_class_id', 'is', null)
    .eq('is_cancelled', false)
    .gte('starts_at', fromISO)
    .lte('starts_at', toISO)
    .order('starts_at', { ascending: true });

  if (error) throw error;

  const items = ((data ?? []) as ClassRow[]).map(mapClassRow);
  if (items.length === 0) {
    return resolveHomeHeroClasses(getAcademyDemoScheduleClasses(), limit, now);
  }
  return resolveHomeHeroClasses(items, limit, now);
}

export async function getUpcomingClasses(): Promise<ClassItem[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('classes')
    .select(CLASS_COLUMNS)
    .gte('starts_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .eq('is_cancelled', false)
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return (data as ClassRow[]).map(mapClassRow);
}

export async function getScheduleCategories(
  fromISO: string,
  toISO: string,
): Promise<ScheduleCategory[]> {
  const day = await fetchScheduleDayClasses(fromISO, toISO);
  return selectScheduleCategories(day);
}

export async function getSchedulePage(input: SchedulePageInput): Promise<ClassItem[]> {
  const day = await fetchScheduleDayClasses(input.fromISO, input.toISO);
  return selectSchedulePage(day, input.category ?? null, input.limit, input.offset);
}

export async function getClassById(id: string): Promise<ClassItem | null> {
  if (isDemoAcademyClassId(id)) {
    return getAcademyDemoClassById(id);
  }

  const { data, error } = await getSupabaseClient()
    .from('classes')
    .select(CLASS_COLUMNS)
    .eq('id', id)
    .maybeSingle<ClassRow>();

  if (error) throw error;
  if (data) return mapClassRow(data);

  return getAcademyDemoClassById(id);
}

export async function getClassesByCoach(coach: CoachItem): Promise<ClassItem[]> {
  const { fromISO, toISO } = gymRangeIso();
  return fetchCoachDayClasses(coach, fromISO, toISO);
}

export async function getClassesByCoachId(coachId: string): Promise<ClassItem[]> {
  const { fromISO, toISO } = gymRangeIso();

  const { data, error } = await getSupabaseClient()
    .from('classes')
    .select(CLASS_COLUMNS)
    .eq('coach_id', coachId)
    .eq('is_cancelled', false)
    .gte('starts_at', fromISO)
    .lte('starts_at', toISO)
    .order('starts_at', { ascending: true });

  if (error) throw error;

  const byCoachId = ((data ?? []) as ClassRow[]).map(mapClassRow);
  if (byCoachId.length > 0) return byCoachId;

  const coach = await getCoachById(coachId);
  if (!coach) return [];

  const byStaffOrName = await getClassesByCoach(coach);
  if (byStaffOrName.length > 0) return byStaffOrName;

  if (__DEV__) {
    return getAcademyDemoClassesForCoach(coach);
  }
  return [];
}
