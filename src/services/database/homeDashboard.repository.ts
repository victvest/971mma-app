import { getSupabaseClient } from '@/services/supabase/client';
import { getBeltPathSummary } from './belt.repository';
import { getCoaches } from './coaches.repository';
import {
  getDisciplineScore,
  getGymWeekActivity,
  getRankEligibility,
} from './discipline.repository';
import { getPointsAccount } from './points.repository';
import { fetchUpcomingHeroClasses } from './classes.repository';
import type {
  BeltProgressItem,
  ClassItem,
  CoachItem,
  DisciplineScoreSummary,
  GymDayActivity,
  PointsAccount,
  RankEligibility,
} from '@/types/domain';

const HOME_SCHEDULE_LIMIT = 3;
const HOME_COACH_PREVIEW_LIMIT = 5;

export type HomeDashboardSummary = {
  upcomingClasses: ClassItem[];
  coachPreview: CoachItem[];
  points: PointsAccount;
  disciplineScore: DisciplineScoreSummary;
  weekActivity: GymDayActivity[];
  rankEligibility: RankEligibility;
  beltProgress: BeltProgressItem | null;
};

type HomeDashboardRpcResponse = {
  upcomingClasses?: ClassItem[];
  coachPreview?: CoachItem[];
  points?: PointsAccount;
  disciplineScore?: DisciplineScoreSummary;
  weekActivity?: GymDayActivity[];
  rankEligibility?: RankEligibility;
  beltProgress?: BeltProgressItem | null;
};

function isMissingHomeDashboardRpc(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: unknown; message?: unknown };
  const code = typeof maybe.code === 'string' ? maybe.code : '';
  const message = typeof maybe.message === 'string' ? maybe.message : '';
  return code === 'PGRST202' || message.includes('get_member_home_dashboard');
}

function normalizeHomeDashboardResponse(
  data: HomeDashboardRpcResponse,
  userId: string,
): HomeDashboardSummary {
  return {
    upcomingClasses: data.upcomingClasses ?? [],
    coachPreview: data.coachPreview ?? [],
    points: data.points ?? {
      userId,
      balance: 0,
      tier: 'bronze',
      lifetimePoints: 0,
      updatedAt: null,
    },
    disciplineScore: data.disciplineScore ?? {
      score: 0,
      currentStreak: 0,
      bestStreak: 0,
      trainingDays: 0,
      trainingDays30d: 0,
      monthlyGoalPct: 0,
      computedAt: null,
      isPlaceholderWeights: false,
    },
    weekActivity: data.weekActivity ?? [],
    rankEligibility: data.rankEligibility ?? {
      eligible: Boolean(data.beltProgress),
      disciplineSlug: data.beltProgress?.discipline ?? null,
      disciplineName: data.beltProgress?.discipline ?? null,
    },
    beltProgress: data.beltProgress ?? null,
  };
}

async function getHomeDashboardViaRpc(userId: string): Promise<HomeDashboardSummary> {
  const { data, error } = await getSupabaseClient().rpc('get_member_home_dashboard', {
    p_user: userId,
  });

  if (error) throw error;
  return normalizeHomeDashboardResponse((data ?? {}) as HomeDashboardRpcResponse, userId);
}

async function getHomeDashboardFallback(userId: string): Promise<HomeDashboardSummary> {
  const [upcomingClasses, coaches, points, rankEligibility, disciplineScore, weekActivity] =
    await Promise.all([
    fetchUpcomingHeroClasses(HOME_SCHEDULE_LIMIT),
    getCoaches(),
    getPointsAccount(userId),
    getRankEligibility(userId),
    getDisciplineScore(userId),
    getGymWeekActivity(userId),
  ]);

  const beltPath = rankEligibility.eligible
    ? await getBeltPathSummary(userId, rankEligibility.disciplineSlug ?? 'bjj')
    : null;

  return {
    upcomingClasses,
    coachPreview: coaches.slice(0, HOME_COACH_PREVIEW_LIMIT),
    points,
    rankEligibility,
    beltProgress: beltPath?.progress ?? null,
    disciplineScore,
    weekActivity,
  };
}

export async function getHomeDashboardSummary(userId: string): Promise<HomeDashboardSummary> {
  let summary: HomeDashboardSummary;

  try {
    summary = await getHomeDashboardViaRpc(userId);
  } catch (error) {
    if (!isMissingHomeDashboardRpc(error)) throw error;
    summary = await getHomeDashboardFallback(userId);
  }

  if (summary.upcomingClasses.length === 0) {
    const upcomingClasses = await fetchUpcomingHeroClasses(HOME_SCHEDULE_LIMIT);
    if (upcomingClasses.length > 0) {
      summary = { ...summary, upcomingClasses };
    }
  }

  return summary;
}
