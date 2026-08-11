import { GYM_TIME_ZONE } from '@/core/time/gymTime';
import { getSupabaseClient } from '@/services/supabase/client';
import type {
  DisciplineScoreSummary,
  GymDayActivity,
  MemberDisciplineEntitlement,
  RankEligibility,
} from '@/types/domain';
import type { DisciplineScoreRow } from '@/types/database';

function parseNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function mapDisciplineRow(row: DisciplineScoreRow | null): DisciplineScoreSummary {
  const components = row?.components ?? {};
  const streakStatus = components.streakStatus;
  return {
    score: row?.score ?? 0,
    currentStreak: parseNumber(components.currentStreak),
    bestStreak: parseNumber(components.bestStreak),
    trainingDays: parseNumber(components.trainingDays),
    trainingDays30d: parseNumber(components.trainingDays30d),
    monthlyGoalPct: parseNumber(components.monthlyGoalPct),
    computedAt: row?.computed_at ?? null,
    isPlaceholderWeights: components.weightsPlaceholder === true,
    streakStatus:
      streakStatus === 'active' ||
      streakStatus === 'grace' ||
      streakStatus === 'broken' ||
      streakStatus === 'inactive'
        ? streakStatus
        : undefined,
    lastTrainingDay:
      typeof components.lastTrainingDay === 'string' ? components.lastTrainingDay : null,
    graceUntil: typeof components.graceUntil === 'string' ? components.graceUntil : null,
    graceDaysUsed: parseNumber(components.graceDaysUsed),
  };
}

type MemberDisciplineRow = {
  id: string;
  discipline_id: string;
  source: MemberDisciplineEntitlement['source'];
  active: boolean;
  starts_on: string | null;
  ends_on: string | null;
  disciplines:
    | {
        slug: string;
        display_name: string;
        has_rank_progression: boolean;
        active: boolean;
      }
    | Array<{
        slug: string;
        display_name: string;
        has_rank_progression: boolean;
        active: boolean;
      }>
    | null;
};

function firstDiscipline(row: MemberDisciplineRow) {
  const discipline = row.disciplines;
  return Array.isArray(discipline) ? discipline[0] : discipline;
}

export async function getMemberDisciplines(userId: string): Promise<MemberDisciplineEntitlement[]> {
  const { data, error } = await getSupabaseClient()
    .from('member_disciplines')
    .select(
      'id, discipline_id, source, active, starts_on, ends_on, disciplines!inner(slug, display_name, has_rank_progression, active)',
    )
    .eq('user_id', userId)
    .eq('active', true);

  if (error) throw error;

  return ((data ?? []) as unknown as MemberDisciplineRow[])
    .map((row) => {
      const discipline = firstDiscipline(row);
      if (!discipline) return null;
      return {
        id: row.id,
        disciplineId: row.discipline_id,
        slug: discipline.slug,
        displayName: discipline.display_name,
        hasRankProgression: Boolean(discipline.has_rank_progression),
        active: row.active && discipline.active,
        source: row.source,
        startsOn: row.starts_on,
        endsOn: row.ends_on,
      } satisfies MemberDisciplineEntitlement;
    })
    .filter((item): item is MemberDisciplineEntitlement => Boolean(item));
}

export async function getRankEligibility(userId: string): Promise<RankEligibility> {
  const disciplines = await getMemberDisciplines(userId);
  const rankDiscipline = disciplines.find((item) => item.active && item.hasRankProgression);

  return {
    eligible: Boolean(rankDiscipline),
    disciplineSlug: rankDiscipline?.slug ?? null,
    disciplineName: rankDiscipline?.displayName ?? null,
  };
}

export async function getDisciplineScore(userId: string): Promise<DisciplineScoreSummary> {
  const { data, error } = await getSupabaseClient()
    .from('discipline_scores')
    .select('user_id, score, components, computed_at')
    .eq('user_id', userId)
    .maybeSingle<DisciplineScoreRow>();

  if (error) throw error;
  return mapDisciplineRow(data);
}

export async function getMemberPercentileRank(userId: string): Promise<number | null> {
  const { data, error } = await getSupabaseClient().rpc('get_member_percentile_rank', {
    p_user_id: userId,
  });

  if (error) throw error;
  return typeof data === 'number' && Number.isFinite(data) ? data : null;
}

function gymDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIME_ZONE }).format(date);
}

/** Gym-local calendar day at noon GST, offset by whole days (device TZ independent). */
function gymDayNoon(offsetDays: number, now = new Date()): Date {
  const todayKey = gymDateKey(now);
  const noon = new Date(`${todayKey}T12:00:00+04:00`);
  noon.setTime(noon.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  return noon;
}

/** Most recent Monday (gym-local), including today when today is Monday. */
function gymMondayNoon(now = new Date()): Date {
  const today = gymDayNoon(0, now);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: GYM_TIME_ZONE,
    weekday: 'short',
  }).format(today);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = map[weekday] ?? 1;
  const distanceToMonday = day === 0 ? -6 : 1 - day;
  return gymDayNoon(distanceToMonday, now);
}

export async function getGymWeekActivity(userId: string): Promise<GymDayActivity[]> {
  const now = new Date();
  const days: GymDayActivity[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    days.push({ date: gymDateKey(gymDayNoon(-offset, now)), trained: false });
  }

  const start = new Date(`${days[0]!.date}T00:00:00+04:00`).toISOString();
  const end = new Date(`${days[days.length - 1]!.date}T23:59:59.999+04:00`).toISOString();

  const { data, error } = await getSupabaseClient()
    .from('check_ins')
    .select('checked_in_at, signed_in, missed, late_cancelled')
    .eq('user_id', userId)
    .gte('checked_in_at', start)
    .lte('checked_in_at', end)
    .eq('signed_in', true)
    .eq('missed', false)
    .eq('late_cancelled', false);

  if (error) throw error;

  const trainedDates = new Set(
    ((data ?? []) as Array<{ checked_in_at: string }>).map((row) =>
      gymDateKey(new Date(row.checked_in_at)),
    ),
  );

  return days.map((day) => ({ ...day, trained: trainedDates.has(day.date) }));
}

export async function getGym8WeeksActivity(userId: string): Promise<number[]> {
  const thisMonday = gymMondayNoon();
  const weekStarts: Date[] = [];
  for (let i = 7; i >= 0; i--) {
    weekStarts.push(new Date(thisMonday.getTime() - i * 7 * 24 * 60 * 60 * 1000));
  }

  const startDateStr = gymDateKey(weekStarts[0]!);
  const startIso = new Date(`${startDateStr}T00:00:00+04:00`).toISOString();

  const { data, error } = await getSupabaseClient()
    .from('check_ins')
    .select('checked_in_at, signed_in, missed, late_cancelled')
    .eq('user_id', userId)
    .gte('checked_in_at', startIso)
    .eq('signed_in', true)
    .eq('missed', false)
    .eq('late_cancelled', false);

  if (error) throw error;

  const counts = new Array(8).fill(0);
  const weekStartKeys = weekStarts.map((d) => gymDateKey(d));

  for (const row of data ?? []) {
    const date = new Date(row.checked_in_at);
    for (let w = 7; w >= 0; w--) {
      const startLimit = new Date(`${weekStartKeys[w]!}T00:00:00+04:00`);
      if (date >= startLimit) {
        counts[w]++;
        break;
      }
    }
  }

  return counts;
}
