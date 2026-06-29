import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listCoachMemberNotesForClass,
  saveCoachMemberNote,
  type CoachMemberNoteItem,
} from '@/services/database/coachMemberNotes.repository';
import { useAuthStore } from '@/stores/useAuthStore';

export const coachMemberNotesKey = (classId: string) => ['coach-member-notes', classId] as const;

function canUseCoachTools(role: string | null | undefined): boolean {
  return role === 'coach' || role === 'admin';
}

export function useCoachMemberNotes(classId: string | null) {
  const role = useAuthStore((s) => s.role);

  return useQuery({
    queryKey: coachMemberNotesKey(classId ?? 'none'),
    queryFn: () => listCoachMemberNotesForClass(classId!),
    enabled: Boolean(classId) && canUseCoachTools(role),
    staleTime: 30 * 1000,
  });
}

export function useSaveCoachMemberNote(classId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveCoachMemberNote,
    onSuccess: (note) => {
      if (!classId) return;
      queryClient.setQueryData<CoachMemberNoteItem[]>(coachMemberNotesKey(classId), (prev) => [
        { ...note, memberName: note.memberName || 'Member' },
        ...(prev ?? []),
      ]);
      void queryClient.invalidateQueries({ queryKey: coachMemberNotesKey(classId) });
    },
  });
}
