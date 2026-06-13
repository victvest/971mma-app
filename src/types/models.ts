/**
 * Provider-agnostic domain models.
 *
 * These are intentionally NOT Supabase-specific so a Mindbody (or any other)
 * provider can return the same shapes. Screens depend only on these.
 */
import type { BookingStatus, MembershipStatus, MembershipTier } from './database';

export type { BookingStatus, MembershipStatus, MembershipTier };

/** A scheduled class, normalized for display. */
export interface ClassItem {
  id: string;
  title: string;
  discipline: string;
  description: string | null;
  coachName: string;
  startsAt: string; // ISO timestamp
  durationMinutes: number;
  capacity: number;
  level: string;
  imageUrl: string | null;
  /** True if the current member has an active (booked/waitlisted) booking. */
  isBooked?: boolean;
  bookingStatus?: BookingStatus;
}

export interface Booking {
  id: string;
  classId: string;
  status: BookingStatus;
  createdAt: string;
}

/** Normalized member profile (maps from Supabase profile OR a Mindbody client). */
export interface MemberProfile {
  id: string;
  fullName: string;
  email?: string | null;
  avatarUrl: string | null;
  phone: string | null;
  membershipTier: MembershipTier;
  membershipStatus: MembershipStatus;
  membershipExpiresAt: string | null;
  beltRank: string | null;
  beltStripes: number;
  /** Identifier in the source system (Supabase uuid now, Mindbody client id later). */
  externalId?: string;
  source: 'supabase' | 'mindbody';
}

export interface Membership {
  tier: MembershipTier;
  status: MembershipStatus;
  expiresAt: string | null;
}

export interface CheckInResult {
  id: string;
  classId: string | null;
  checkedInAt: string;
  method: string;
}

/** Lightweight reference to a member resolved from a QR token. */
export interface MemberRef {
  memberId: string;
  source: 'supabase' | 'mindbody';
}

export type ProfilePatch = Partial<
  Pick<MemberProfile, 'fullName' | 'phone' | 'avatarUrl' | 'beltRank' | 'beltStripes'>
>;
