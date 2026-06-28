import { getSupabaseClient } from '@/services/supabase/client';
import { getDisciplineScore } from './discipline.repository';
import {
  awardDemoPromotion,
  getDemoCoachMemberBeltPath,
  markDemoRequirementStatus,
  searchDemoCoachMembers,
} from '@/features/coach/demo/coachDemoFixtures';
import { isCoachDemoMode, isDemoCoachMemberId } from '@/features/coach/demo/coachDemoMode';
import type {
  BeltPathSummary,
  BeltProgressItem,
  BeltRequirementItem,
  BeltRankItem,
  CoachMemberSearchItem,
  PromotionItem,
} from '@/types/domain';
import type {
  BeltRankRow,
  BeltRequirementRow,
  MemberBeltProgressRow,
  PromotionRow,
} from '@/types/database';

const DEFAULT_DISCIPLINE = 'bjj';

export async function refreshBeltProgress(
  userId: string,
  discipline = DEFAULT_DISCIPLINE,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('recompute_belt_progress', {
    p_user: userId,
    p_discipline: discipline,
  });
  if (error) throw error;
}

async function getRankMap(discipline = DEFAULT_DISCIPLINE): Promise<Map<string, BeltRankItem>> {
  const { data, error } = await getSupabaseClient()
    .from('rank_levels')
    .select(`
      id,
      name,
      level_order,
      stripe_count,
      rank_systems!inner (
        disciplines!inner (
          slug
        )
      )
    `)
    .eq('rank_systems.disciplines.slug', discipline)
    .order('level_order', { ascending: true });

  if (error) throw error;

  const map = new Map<string, BeltRankItem>();
  for (const row of (data ?? []) as any[]) {
    map.set(row.id, {
      id: row.id,
      discipline: discipline,
      name: row.name,
      order: row.level_order,
      stripes: row.stripe_count,
    });
  }
  return map;
}

function mapProgressRow(
  row: any,
  discipline: string,
  rankName: string,
  maxStripes: number,
  trainingDays: number,
): BeltProgressItem {
  return {
    userId: row.user_id,
    discipline,
    rankId: row.rank_level_id,
    rankName,
    stripe: row.stripe,
    maxStripes,
    percent: Number(row.percent_complete),
    trainingDays,
    updatedAt: row.updated_at,
  };
}

export async function getBeltPathSummary(
  userId: string,
  discipline = DEFAULT_DISCIPLINE,
): Promise<BeltPathSummary> {
  const rankMap = await getRankMap(discipline);
  const defaultRank = [...rankMap.values()][0];

  const { data: discData, error: discError } = await getSupabaseClient()
    .from('disciplines')
    .select('id')
    .eq('slug', discipline)
    .maybeSingle();

  if (discError) throw discError;
  const disciplineId = discData?.id;

  const [disciplineScore, progressResult, promotionsResult] = await Promise.all([
    getDisciplineScore(userId),
    disciplineId
      ? getSupabaseClient()
          .from('member_rank_progress')
          .select('user_id, discipline_id, rank_level_id, stripe, percent_complete, updated_at')
          .eq('user_id', userId)
          .eq('discipline_id', disciplineId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    disciplineId
      ? getSupabaseClient()
          .from('rank_promotions')
          .select('id, discipline_id, from_rank_level_id, to_rank_level_id, from_stripe, to_stripe, awarded_at')
          .eq('user_id', userId)
          .eq('discipline_id', disciplineId)
          .order('awarded_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (progressResult.error) throw progressResult.error;
  if (promotionsResult.error) throw promotionsResult.error;

  const trainingDays = disciplineScore.trainingDays;
  const progressRow = progressResult.data as any;
  const rankId = progressRow?.rank_level_id ?? defaultRank?.id ?? null;
  const rank = rankId ? rankMap.get(rankId) : defaultRank;

  const progress = progressRow
    ? mapProgressRow(
        progressRow,
        discipline,
        rank?.name ?? 'White',
        rank?.stripes ?? 4,
        trainingDays,
      )
    : {
        userId,
        discipline,
        rankId,
        rankName: rank?.name ?? 'White',
        stripe: 0,
        maxStripes: rank?.stripes ?? 4,
        percent: 0,
        trainingDays,
        updatedAt: new Date().toISOString(),
      };

  let requirements: BeltRequirementItem[] = [];
  if (rankId) {
    const [requirementsResult, statusesResult] = await Promise.all([
      getSupabaseClient()
        .from('rank_requirements')
        .select('id, rank_level_id, stripe, title, description, requirement_type, attendance_target, sort_order')
        .eq('rank_level_id', rankId)
        .order('stripe', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('title', { ascending: true }),
      getSupabaseClient()
        .from('member_requirement_statuses')
        .select('rank_requirement_id, status, assessed_at')
        .eq('user_id', userId),
    ]);

    if (requirementsResult.error) throw requirementsResult.error;
    if (statusesResult.error) throw statusesResult.error;

    const statusMap = new Map<string, { status: BeltRequirementItem['status']; assessedAt: string | null }>();
    for (const row of (statusesResult.data ?? []) as Array<{
      rank_requirement_id: string;
      status: BeltRequirementItem['status'];
      assessed_at: string | null;
    }>) {
      statusMap.set(row.rank_requirement_id, { status: row.status, assessedAt: row.assessed_at });
    }

    requirements = ((requirementsResult.data ?? []) as any[]).map((row) => {
      const statusRow = statusMap.get(row.id);
      return {
        id: row.id,
        rankId: row.rank_level_id,
        stripe: row.stripe,
        title: row.title,
        description: row.description,
        type: row.requirement_type,
        attendanceTarget: row.attendance_target,
        unlockAfterStripe: null,
        status: statusRow?.status ?? 'locked',
        assessedAt: statusRow?.assessedAt ?? null,
      };
    });
  }

  const isPlaceholderCurriculum =
    requirements.length === 0 ||
    requirements.every((item) => item.description?.toLowerCase().includes('placeholder') ?? false);

  const promotions: PromotionItem[] = ((promotionsResult.data ?? []) as any[]).map(
    (row) => ({
      id: row.id,
      discipline: discipline,
      fromRankName: row.from_rank_level_id ? (rankMap.get(row.from_rank_level_id)?.name ?? null) : null,
      toRankName: row.to_rank_level_id ? (rankMap.get(row.to_rank_level_id)?.name ?? null) : null,
      fromStripe: row.from_stripe,
      toStripe: row.to_stripe,
      awardedAt: row.awarded_at,
    }),
  );

  return {
    progress,
    requirements,
    promotions,
    isPlaceholderCurriculum,
  };
}

export async function markRequirementStatus(
  userId: string,
  requirementId: string,
  status: 'now' | 'done',
): Promise<void> {
  if (isCoachDemoMode() && isDemoCoachMemberId(userId)) {
    markDemoRequirementStatus(userId, requirementId, status);
    return;
  }

  const { error } = await getSupabaseClient().rpc('mark_requirement_status', {
    p_user: userId,
    p_requirement: requirementId,
    p_status: status === 'now' ? 'next' : 'done',
  });
  if (error) throw error;
}

export async function awardPromotion(
  userId: string,
  options: { toStripe?: number; toRankId?: string; discipline?: string } = {},
): Promise<void> {
  if (isCoachDemoMode() && isDemoCoachMemberId(userId)) {
    void options;
    awardDemoPromotion(userId);
    return;
  }

  const { error } = await getSupabaseClient().rpc('award_promotion', {
    p_user: userId,
    p_discipline: options.discipline ?? DEFAULT_DISCIPLINE,
    p_to_stripe: options.toStripe ?? null,
    p_to_rank: options.toRankId ?? null,
  });
  if (error) throw error;
}

export async function searchMembersForCoach(query: string): Promise<CoachMemberSearchItem[]> {
  if (isCoachDemoMode()) {
    return searchDemoCoachMembers(query);
  }

  const { data, error } = await getSupabaseClient().rpc('coach_search_members', {
    p_query: query,
  });
  if (error) throw error;

  return ((data ?? []) as Array<{
    id: string;
    full_name: string;
    email: string;
    belt_rank: string | null;
    belt_stripes: number;
  }>).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    beltRank: row.belt_rank,
    beltStripes: row.belt_stripes ?? 0,
  }));
}

export async function getCoachMemberBeltPath(
  userId: string,
  discipline = DEFAULT_DISCIPLINE,
): Promise<BeltPathSummary> {
  if (isCoachDemoMode() && isDemoCoachMemberId(userId)) {
    void discipline;
    return getDemoCoachMemberBeltPath(userId);
  }
  return getBeltPathSummary(userId, discipline);
}
