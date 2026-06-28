import { gymRangeIso } from '@/core/time/gymTime';
import {
  selectClassesByCoach,
  selectScheduleCategories,
  selectSchedulePage,
} from '@/features/schedule/utils/scheduleDaySelectors';
import type { ScheduleCategory } from '@/features/schedule/utils/scheduleCategory';
import { getSupabaseClient } from '@/services/supabase/client';
import type { ClassRow } from '@/types/database';
import type { ClassItem, CoachItem } from '@/types/domain';
import { getCoachById } from './coaches.repository';
import { mapClassRow } from './mappers';

const CLASS_COLUMNS =
  'id, title, discipline, discipline_id, description, coach_name, coach_id, starts_at, duration_minutes, capacity, level, image_url, mindbody_class_id, staff_mindbody_id, booked_count, is_available, is_waitlist_available, is_cancelled';

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
  return ((data ?? []) as ClassRow[]).map(mapClassRow);
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
    return ((data ?? []) as ClassRow[]).map(mapClassRow);
  }

  const day = await fetchScheduleDayClasses(fromISO, toISO);
  return selectClassesByCoach(day, coach);
}

const UPCOMING_HERO_LOOKBACK_MS = 3 * 60 * 60 * 1000;

/** Next non-cancelled Mindbody classes that have not ended yet (today or later). */
export async function fetchUpcomingHeroClasses(limit: number): Promise<ClassItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('classes')
    .select(CLASS_COLUMNS)
    .not('mindbody_class_id', 'is', null)
    .eq('is_cancelled', false)
    .gte('starts_at', new Date(Date.now() - UPCOMING_HERO_LOOKBACK_MS).toISOString())
    .order('starts_at', { ascending: true });

  if (error) throw error;

  const now = Date.now();
  return ((data ?? []) as ClassRow[])
    .map(mapClassRow)
    .filter((item) => new Date(item.startsAt).getTime() + item.durationMinutes * 60_000 > now)
    .slice(0, limit);
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
  const { data, error } = await getSupabaseClient()
    .from('classes')
    .select(CLASS_COLUMNS)
    .eq('id', id)
    .maybeSingle<ClassRow>();

  if (error) throw error;
  return data ? mapClassRow(data) : null;
}

export async function getClassesByCoach(coach: CoachItem): Promise<ClassItem[]> {
  const { fromISO, toISO } = gymRangeIso();
  return fetchCoachDayClasses(coach, fromISO, toISO);
}

export async function getClassesByCoachId(coachId: string): Promise<ClassItem[]> {
  const coach = await getCoachById(coachId);
  if (!coach) return [];
  return getClassesByCoach(coach);
}
