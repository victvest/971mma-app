import { getSupabaseClient } from '@/services/supabase/client';
import type { CheckInRow } from '@/types/database';
import type { CheckInResult } from '@/types/domain';

export async function recordCheckIn(args: {
  classId?: string | null;
  method?: string;
  userId?: string;
}): Promise<CheckInResult> {
  let uid = args.userId;
  if (!uid) {
    const { data: userData } = await getSupabaseClient().auth.getUser();
    uid = userData.user?.id;
  }
  if (!uid) throw new Error('Not authenticated');

  const { data, error } = await getSupabaseClient()
    .from('check_ins')
    .insert({ user_id: uid, class_id: args.classId ?? null, method: args.method ?? 'qr_self' })
    .select()
    .single();

  if (error) throw error;
  const row = data as CheckInRow;
  return {
    id: row.id,
    classId: row.class_id,
    checkedInAt: row.checked_in_at,
    method: row.method,
  };
}
