import { getSupabaseClient } from '@/services/supabase/client';
import type { CoachRow } from '@/types/database';
import type { CoachItem } from '@/types/domain';
import { mapCoachRow } from './mappers';

const COACH_COLUMNS =
  'id, user_id, mindbody_staff_id, name, specialty, rank, rating, bio, photo_url, is_head_coach, coaching_philosophy, years_experience, years_martial_arts, years_coaching, fight_record, titles, certifications, languages, nickname, status_achievements, experience_highlights, coaching_style, invite_blurb, sort_order, last_synced_at, created_at';

export async function getCoaches(): Promise<CoachItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('coaches')
    .select(COACH_COLUMNS)
    .not('mindbody_staff_id', 'is', null)
    .eq('active', true)
    .eq('visible_in_app', true)
    .is('deleted_at', null)
    .order('is_head_coach', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data as CoachRow[]).map(mapCoachRow);
}

export async function getCoachByUserId(userId: string): Promise<CoachItem | null> {
  const { data, error } = await getSupabaseClient()
    .from('coaches')
    .select(COACH_COLUMNS)
    .eq('user_id', userId)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle<CoachRow>();

  if (error) throw error;
  return data ? mapCoachRow(data) : null;
}

export async function getCoachById(id: string): Promise<CoachItem | null> {
  const { data, error } = await getSupabaseClient()
    .from('coaches')
    .select(COACH_COLUMNS)
    .eq('id', id)
    .eq('visible_in_app', true)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle<CoachRow>();

  if (error) throw error;
  return data ? mapCoachRow(data) : null;
}
