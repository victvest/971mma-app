import { getSupabaseClient } from '@/services/supabase/client';
import type { CoachRow } from '@/types/database';
import type { CoachItem } from '@/types/domain';
import { mapCoachRow } from './mappers';

const COACH_COLUMNS =
  'id, mindbody_staff_id, name, specialty, rank, rating, bio, photo_url, is_head_coach, coaching_philosophy, years_experience, fight_record, titles, certifications, languages, sort_order, last_synced_at, created_at';

export async function getCoaches(): Promise<CoachItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('coaches')
    .select(COACH_COLUMNS)
    .not('slug', 'is', null)
    .order('is_head_coach', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data as CoachRow[]).map(mapCoachRow);
}

export async function getCoachById(id: string): Promise<CoachItem | null> {
  const { data, error } = await getSupabaseClient()
    .from('coaches')
    .select(COACH_COLUMNS)
    .eq('id', id)
    .maybeSingle<CoachRow>();

  if (error) throw error;
  return data ? mapCoachRow(data) : null;
}
