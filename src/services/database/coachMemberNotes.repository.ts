import { DEMO_COACH_ASSIGNED_DISCIPLINES } from '@/features/coach/demo/coachDemoFixtures';
import { isCoachDemoMode } from '@/features/coach/demo/coachDemoMode';
import { getSupabaseClient } from '@/services/supabase/client';

export type CoachMemberNoteItem = {
  id: string;
  userId: string;
  memberName: string;
  body: string;
  visibility: 'coach_admin' | 'member_visible';
  createdAt: string;
};

export type CoachAssignedDiscipline = {
  id: string;
  slug: string;
  displayName: string;
  hasRankProgression: boolean;
};

function isMissingCoachNotesRpc(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: unknown; message?: unknown };
  const code = typeof maybe.code === 'string' ? maybe.code : '';
  const message = typeof maybe.message === 'string' ? maybe.message : '';
  return (
    code === 'PGRST202' ||
    message.includes('save_coach_member_note') ||
    message.includes('list_coach_member_notes_for_class') ||
    message.includes('get_coach_assigned_disciplines')
  );
}

export async function listCoachMemberNotesForClass(
  classId: string,
): Promise<CoachMemberNoteItem[]> {
  const { data, error } = await getSupabaseClient().rpc('list_coach_member_notes_for_class', {
    p_class_id: classId,
  });

  if (error) {
    if (isMissingCoachNotesRpc(error)) return [];
    throw error;
  }

  return ((data ?? []) as CoachMemberNoteItem[]).map((row) => ({
    id: row.id,
    userId: row.userId,
    memberName: row.memberName,
    body: row.body,
    visibility: row.visibility,
    createdAt: row.createdAt,
  }));
}

export async function saveCoachMemberNote(input: {
  userId: string;
  classId: string | null;
  disciplineId: string;
  body: string;
  visibility?: 'coach_admin' | 'member_visible';
}): Promise<CoachMemberNoteItem> {
  const { data, error } = await getSupabaseClient().rpc('save_coach_member_note', {
    p_user_id: input.userId,
    p_class_id: input.classId,
    p_discipline_id: input.disciplineId,
    p_body: input.body.trim(),
    p_visibility: input.visibility ?? 'coach_admin',
  });

  if (error) throw error;

  const row = data as {
    id: string;
    userId: string;
    body: string;
    visibility: CoachMemberNoteItem['visibility'];
    createdAt: string;
  };

  return {
    id: row.id,
    userId: row.userId,
    memberName: 'Member',
    body: row.body,
    visibility: row.visibility,
    createdAt: row.createdAt,
  };
}

export async function getCoachAssignedDisciplines(
  coachId?: string,
): Promise<CoachAssignedDiscipline[]> {
  if (isCoachDemoMode()) {
    void coachId;
    return DEMO_COACH_ASSIGNED_DISCIPLINES.map((item) => ({ ...item }));
  }

  const { data, error } = await getSupabaseClient().rpc('get_coach_assigned_disciplines', {
    p_coach_id: coachId ?? null,
  });

  if (error) {
    if (isMissingCoachNotesRpc(error)) return [];
    throw error;
  }

  return ((data ?? []) as CoachAssignedDiscipline[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    hasRankProgression: row.hasRankProgression,
  }));
}
