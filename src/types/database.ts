/**
 * Row shapes for the Supabase `public` schema.
 * Mirrors BACKEND_SETUP.md. These are storage-layer types — screens should
 * consume the domain models in `models.ts` instead.
 */

export type MembershipTier = 'standard' | 'pro' | 'elite';
export type MembershipStatus = 'active' | 'paused' | 'expired';
export type BookingStatus = 'booked' | 'waitlisted' | 'cancelled' | 'attended';

export interface ProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  membership_tier: MembershipTier;
  membership_status: MembershipStatus;
  membership_expires_at: string | null;
  belt_rank: string | null;
  belt_stripes: number;
  created_at: string;
  updated_at: string;
}

export interface ClassRow {
  id: string;
  title: string;
  discipline: string;
  description: string | null;
  coach_name: string | null;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  level: string | null;
  image_url: string | null;
  created_at: string;
}

export interface BookingRow {
  id: string;
  user_id: string;
  class_id: string;
  status: BookingStatus;
  created_at: string;
}

export interface CheckInRow {
  id: string;
  user_id: string;
  class_id: string | null;
  checked_in_at: string;
  method: string;
}
