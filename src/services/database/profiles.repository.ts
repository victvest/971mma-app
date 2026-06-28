import { getSupabaseClient } from '@/services/supabase/client';
import type { ProfileRow } from '@/types/database';
import type { MemberProfile, OnboardingInput, ProfilePatch } from '@/types/domain';
import { mapProfileRow } from './mappers';

export async function getProfileById(userId: string): Promise<MemberProfile | null> {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapProfileRow(data as ProfileRow, null);
}

export async function getMyProfile(userId?: string): Promise<MemberProfile | null> {
  const resolvedUserId = userId ?? (await (async () => {
    const { data: userData } = await getSupabaseClient().auth.getUser();
    return userData.user?.id ?? null;
  })());

  if (!resolvedUserId) return null;

  const { data: userData } = await getSupabaseClient().auth.getUser();
  const email = userData.user?.id === resolvedUserId ? userData.user.email : null;

  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('*')
    .eq('id', resolvedUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapProfileRow(data as ProfileRow, email);
}

export async function updateMyProfile(patch: ProfilePatch): Promise<MemberProfile> {
  const { data: userData } = await getSupabaseClient().auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('Not authenticated');

  const update: Record<string, unknown> = {};
  if (patch.fullName !== undefined) update.full_name = patch.fullName;
  if (patch.phone !== undefined) update.phone = patch.phone;
  if (patch.avatarUrl !== undefined) update.avatar_url = patch.avatarUrl;
  if (patch.beltRank !== undefined) update.belt_rank = patch.beltRank;
  if (patch.beltStripes !== undefined) update.belt_stripes = patch.beltStripes;
  if (patch.dateOfBirth !== undefined) update.date_of_birth = patch.dateOfBirth;

  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .update(update)
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  return mapProfileRow(data as ProfileRow, user.email);
}

export async function completeOnboarding(input: OnboardingInput): Promise<MemberProfile> {
  const { data: userData } = await getSupabaseClient().auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .update({
      full_name: input.fullName.trim(),
      date_of_birth: input.dateOfBirth,
      avatar_url: input.avatarUrl,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;

  const mappedProfile = mapProfileRow(data as ProfileRow, user.email);

  void getSupabaseClient().auth.updateUser({
    data: { full_name: input.fullName.trim() },
  });

  return mappedProfile;
}
