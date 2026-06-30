import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RankDisciplineSlug } from '@/features/coach/hooks/useCoachAssignedDisciplines';
import {
  deleteCoachRankRequirement,
  listCoachRankCurriculum,
  upsertCoachRankRequirement,
} from '@/services/database/coachCurriculum.repository';
import type { UpsertCoachRankRequirementInput } from '@/types/domain';

export const coachCurriculumKey = (disciplineSlug: RankDisciplineSlug) =>
  ['coach-curriculum', disciplineSlug] as const;

export function useCoachRankCurriculum(disciplineSlug: RankDisciplineSlug | null, enabled = true) {
  return useQuery({
    queryKey: coachCurriculumKey(disciplineSlug ?? 'bjj'),
    queryFn: () => listCoachRankCurriculum(disciplineSlug!),
    enabled: enabled && Boolean(disciplineSlug),
    staleTime: 60 * 1000,
  });
}

export function useUpsertCoachRankRequirement(disciplineSlug: RankDisciplineSlug | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<UpsertCoachRankRequirementInput, 'disciplineSlug'>) => {
      if (!disciplineSlug) {
        return Promise.reject(new Error('No discipline selected'));
      }
      return upsertCoachRankRequirement({ ...input, disciplineSlug });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(coachCurriculumKey(data.disciplineSlug as RankDisciplineSlug), data);
    },
  });
}

export function useDeleteCoachRankRequirement(disciplineSlug: RankDisciplineSlug | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requirementId: string) => deleteCoachRankRequirement(requirementId),
    onSuccess: (data) => {
      queryClient.setQueryData(coachCurriculumKey(data.disciplineSlug as RankDisciplineSlug), data);
      if (disciplineSlug && disciplineSlug !== data.disciplineSlug) {
        void queryClient.invalidateQueries({ queryKey: coachCurriculumKey(disciplineSlug) });
      }
    },
  });
}
