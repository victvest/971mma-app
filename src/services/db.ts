/**
 * Typed Supabase data layer.
 *
 * Thin, well-typed wrappers over the `public` schema tables. Higher-level
 * member/check-in concerns go through the integration provider layer
 * (`services/integrations`) so they can swap to Mindbody later; this module is
 * the Supabase-specific implementation those providers build on.
 */
import { supabase } from '../lib/supabase';
import type {
  BookingRow,
  ClassRow,
  CheckInRow,
  ProfileRow,
} from '../types/database';
import type {
  Booking,
  CheckInResult,
  ClassItem,
  MemberProfile,
  ProfilePatch,
} from '../types/models';

/* ----------------------------- mappers ----------------------------- */

export function mapClassRow(row: ClassRow): ClassItem {
  return {
    id: row.id,
    title: row.title,
    discipline: row.discipline,
    description: row.description,
    coachName: row.coach_name ?? 'Coach',
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    capacity: row.capacity,
    level: row.level ?? 'All Levels',
    imageUrl: row.image_url,
  };
}

export function mapProfileRow(row: ProfileRow, email?: string | null): MemberProfile {
  return {
    id: row.id,
    fullName: row.full_name ?? '',
    email: email ?? null,
    avatarUrl: row.avatar_url,
    phone: row.phone,
    membershipTier: row.membership_tier,
    membershipStatus: row.membership_status,
    membershipExpiresAt: row.membership_expires_at,
    beltRank: row.belt_rank,
    beltStripes: row.belt_stripes ?? 0,
    externalId: row.id,
    source: 'supabase',
  };
}

function mapBookingRow(row: BookingRow): Booking {
  return { id: row.id, classId: row.class_id, status: row.status, createdAt: row.created_at };
}

/* ----------------------------- classes ----------------------------- */

export async function getUpcomingClasses(): Promise<ClassItem[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .gte('starts_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return (data as ClassRow[]).map(mapClassRow);
}

/* ----------------------------- bookings ----------------------------- */

export async function getMyBookings(): Promise<Booking[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', uid)
    .neq('status', 'cancelled');

  if (error) throw error;
  return (data as BookingRow[]).map(mapBookingRow);
}

export async function bookClass(classId: string): Promise<Booking> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('Not authenticated');

  // Upsert so re-booking a previously cancelled class flips it back to booked.
  const { data, error } = await supabase
    .from('bookings')
    .upsert(
      { user_id: uid, class_id: classId, status: 'booked' },
      { onConflict: 'user_id,class_id' },
    )
    .select()
    .single();

  if (error) throw error;
  return mapBookingRow(data as BookingRow);
}

export async function cancelBooking(classId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('user_id', uid)
    .eq('class_id', classId);

  if (error) throw error;
}

/* ----------------------------- check-ins ----------------------------- */

export async function recordCheckIn(args: {
  classId?: string | null;
  method?: string;
  userId?: string;
}): Promise<CheckInResult> {
  let uid = args.userId;
  if (!uid) {
    const { data: userData } = await supabase.auth.getUser();
    uid = userData.user?.id;
  }
  if (!uid) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('check_ins')
    .insert({ user_id: uid, class_id: args.classId ?? null, method: args.method ?? 'qr' })
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

export type CheckInWithClass = CheckInRow & { classes: ClassRow | null };

export async function listMyCheckIns(limit = 60): Promise<CheckInWithClass[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('check_ins')
    .select('*, classes(*)')
    .eq('user_id', uid)
    .order('checked_in_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as CheckInWithClass[];
}

/* ----------------------------- profile ----------------------------- */

export async function getMyProfile(): Promise<MemberProfile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapProfileRow(data as ProfileRow, user.email);
}

export async function updateMyProfile(patch: ProfilePatch): Promise<MemberProfile> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('Not authenticated');

  const update: Record<string, unknown> = {};
  if (patch.fullName !== undefined) update.full_name = patch.fullName;
  if (patch.phone !== undefined) update.phone = patch.phone;
  if (patch.avatarUrl !== undefined) update.avatar_url = patch.avatarUrl;
  if (patch.beltRank !== undefined) update.belt_rank = patch.beltRank;
  if (patch.beltStripes !== undefined) update.belt_stripes = patch.beltStripes;

  const { data, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  return mapProfileRow(data as ProfileRow, user.email);
}
