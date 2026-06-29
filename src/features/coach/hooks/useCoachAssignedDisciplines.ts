import { useQuery } from '@tanstack/react-query';
import { useMyCoachRecord } from '@/features/coach/hooks/useMyCoachRecord';
import { getCoachAssignedDisciplines } from '@/services/database/coachMemberNotes.repository';
import { useAuthStore } from '@/stores/useAuthStore';

export type RankDisciplineSlug = 'bjj' | 'wrestling';

export const coachAssignedDisciplinesKey = (coachId: string) =>
  ['coach-assigned-disciplines', coachId] as const;

function canUseCoachTools(role: string | null | undefined): boolean {
  return role === 'coach' || role === 'admin';
}

export function useCoachAssignedDisciplines() {
  const role = useAuthStore((s) => s.role);
  const { coach, isLoading: coachLoading } = useMyCoachRecord();

  const query = useQuery({
    queryKey: coachAssignedDisciplinesKey(coach?.id ?? 'none'),
    queryFn: () => getCoachAssignedDisciplines(coach!.id),
    enabled: canUseCoachTools(role) && Boolean(coach),
    staleTime: 5 * 60 * 1000,
  });

  const rankDisciplines = (query.data ?? []).filter((item) => item.hasRankProgression);
  const primaryRankDiscipline = rankDisciplines[0] ?? null;

  return {
    ...query,
    isLoading: query.isLoading || coachLoading,
    rankDisciplines,
    rankDisciplineSlugs: rankDisciplines.map((item) => item.slug as RankDisciplineSlug),
    primaryRankDiscipline,
    primaryRankDisciplineSlug: (primaryRankDiscipline?.slug as RankDisciplineSlug | undefined) ?? null,
  };
}
