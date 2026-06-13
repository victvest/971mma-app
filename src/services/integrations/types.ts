/**
 * Provider interfaces for member + check-in concerns.
 *
 * Screens depend ONLY on these interfaces, never on Supabase or Mindbody
 * directly. Swap the active implementation in `src/config/integrations.ts`.
 */
import type {
  CheckInResult,
  MemberProfile,
  MemberRef,
  Membership,
  ProfilePatch,
} from '../../types/models';

export type ProviderSource = 'supabase' | 'mindbody';

/** Read/write member identity + membership. */
export interface MemberProvider {
  readonly source: ProviderSource;

  /** Current member when `externalId` omitted, otherwise the referenced member. */
  getMemberProfile(externalId?: string): Promise<MemberProfile | null>;

  /** Patch the current member's profile. */
  updateMemberProfile(patch: ProfilePatch, externalId?: string): Promise<MemberProfile>;

  /** Resolve a scanned QR token to a member reference (no network for Supabase). */
  resolveMemberByQrToken(token: string): Promise<MemberRef | null>;

  /** Memberships/entitlements for a member (current member when omitted). */
  listMemberships(externalId?: string): Promise<Membership[]>;
}

/** Record attendance / door check-ins. */
export interface CheckInProvider {
  readonly source: ProviderSource;

  recordCheckIn(input: {
    memberId?: string;
    classId?: string | null;
    method?: string;
  }): Promise<CheckInResult>;
}

/** A single object can satisfy both roles (Supabase + Mindbody do). */
export interface IntegrationProvider extends MemberProvider, CheckInProvider {}
