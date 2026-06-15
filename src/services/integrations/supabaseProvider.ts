/**
 * Supabase-backed implementation of the integration interfaces.
 * This is the default provider today.
 */
import {
  getMyProfile,
  listMyCheckIns,
  recordCheckIn as dbRecordCheckIn,
  updateMyProfile,
} from '../db';
import { parseMemberQrToken } from '../qrToken';
import type {
  CheckInResult,
  MemberProfile,
  MemberRef,
  Membership,
  ProfilePatch,
} from '../../types/models';
import type { IntegrationProvider, ProviderSource } from './types';

export class SupabaseProvider implements IntegrationProvider {
  readonly source: ProviderSource = 'supabase';

  async getMemberProfile(externalId?: string): Promise<MemberProfile | null> {
    // RLS scopes reads to the current user; `externalId` is only meaningful
    // once a privileged (staff) context exists. For now we return self.
    return getMyProfile();
  }

  async updateMemberProfile(patch: ProfilePatch): Promise<MemberProfile> {
    return updateMyProfile(patch);
  }

  async resolveMemberByQrToken(token: string): Promise<MemberRef | null> {
    const ref = parseMemberQrToken(token);
    if (!ref) return null;
    // Supabase tokens already carry the profile uuid; nothing to fetch.
    return ref.source === 'supabase' ? ref : null;
  }

  async listMemberships(externalId?: string): Promise<Membership[]> {
    const profile = await getMyProfile();
    if (!profile) return [];
    return [
      {
        tier: profile.membershipTier,
        status: profile.membershipStatus,
        expiresAt: profile.membershipExpiresAt,
      },
    ];
  }

  async recordCheckIn(input: {
    memberId?: string;
    classId?: string | null;
    method?: string;
  }): Promise<CheckInResult> {
    return dbRecordCheckIn({
      classId: input.classId ?? null,
      method: input.method ?? 'qr',
      userId: input.memberId,
    });
  }

  async listCheckIns(input?: { limit?: number }): Promise<CheckInResult[]> {
    const rows = await listMyCheckIns(input?.limit ?? 60);
    return rows.map((row) => ({
      id: row.id,
      classId: row.class_id,
      checkedInAt: row.checked_in_at,
      method: row.method,
    }));
  }
}
