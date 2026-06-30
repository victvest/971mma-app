import {
  getDemoCoachRankCurriculum,
  upsertDemoCoachRankRequirement,
  deleteDemoCoachRankRequirement,
} from '@/features/coach/demo/coachDemoFixtures';
import { isCoachDemoMode } from '@/features/coach/demo/coachDemoMode';
import type { RankDisciplineSlug } from '@/features/coach/hooks/useCoachAssignedDisciplines';
import { getSupabaseClient } from '@/services/supabase/client';
import type { CoachCurriculumSummary, UpsertCoachRankRequirementInput } from '@/types/domain';

type CurriculumRpcPayload = {
  disciplineSlug: string;
  ranks: Array<{ id: string; name: string; order: number; stripes: number }>;
  requirements: Array<{
    id: string;
    rankLevelId: string;
    rankName: string;
    stripe: number;
    title: string;
    description: string | null;
    requirementType: string;
    attendanceTarget: number | null;
    sortOrder: number;
  }>;
};

function mapCurriculumPayload(payload: CurriculumRpcPayload): CoachCurriculumSummary {
  return {
    disciplineSlug: payload.disciplineSlug,
    ranks: (payload.ranks ?? []).map((rank) => ({
      id: rank.id,
      name: rank.name,
      order: rank.order,
      stripes: rank.stripes,
    })),
    requirements: (payload.requirements ?? []).map((row) => ({
      id: row.id,
      rankLevelId: row.rankLevelId,
      rankName: row.rankName,
      stripe: row.stripe,
      title: row.title,
      description: row.description,
      requirementType: row.requirementType as CoachCurriculumSummary['requirements'][number]['requirementType'],
      attendanceTarget: row.attendanceTarget,
      sortOrder: row.sortOrder,
    })),
  };
}

export async function listCoachRankCurriculum(
  disciplineSlug: RankDisciplineSlug,
): Promise<CoachCurriculumSummary> {
  if (isCoachDemoMode()) {
    return getDemoCoachRankCurriculum(disciplineSlug);
  }

  const { data, error } = await getSupabaseClient().rpc('list_coach_rank_curriculum', {
    p_discipline_slug: disciplineSlug,
  });

  if (error) throw error;
  return mapCurriculumPayload(data as CurriculumRpcPayload);
}

export async function upsertCoachRankRequirement(
  input: UpsertCoachRankRequirementInput,
): Promise<CoachCurriculumSummary> {
  if (isCoachDemoMode()) {
    return upsertDemoCoachRankRequirement(input);
  }

  const { data, error } = await getSupabaseClient().rpc('upsert_coach_rank_requirement', {
    p_discipline_slug: input.disciplineSlug,
    p_rank_level_id: input.rankLevelId,
    p_stripe: input.stripe,
    p_title: input.title,
    p_description: input.description ?? null,
    p_requirement_type: input.requirementType ?? 'skill',
    p_attendance_target: input.attendanceTarget ?? null,
    p_sort_order: input.sortOrder ?? 0,
    p_requirement_id: input.requirementId ?? null,
  });

  if (error) throw error;
  return mapCurriculumPayload(data as CurriculumRpcPayload);
}

export async function deleteCoachRankRequirement(
  requirementId: string,
): Promise<CoachCurriculumSummary> {
  if (isCoachDemoMode()) {
    return deleteDemoCoachRankRequirement(requirementId);
  }

  const { data, error } = await getSupabaseClient().rpc('delete_coach_rank_requirement', {
    p_requirement_id: requirementId,
  });

  if (error) throw error;
  return mapCurriculumPayload(data as CurriculumRpcPayload);
}
