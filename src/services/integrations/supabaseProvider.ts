import { getMyProfile, updateMyProfile, getMembershipSummary } from '@/services/database';
import { invokeEdge } from '@/services/mindbody/edgeClient';
import { parseMemberQrToken } from '@/services/qr/token';
import type {
  CheckInResult,
  MemberProfile,
  MemberRef,
  Membership,
  ProfilePatch,
} from '@/types/domain';
import type { IntegrationProvider, ProviderSource } from './types';

export class SupabaseProvider implements IntegrationProvider {
  readonly source: ProviderSource = 'supabase';

  async getMemberProfile(_externalId?: string): Promise<MemberProfile | null> {
    return getMyProfile();
  }

  async updateMemberProfile(patch: ProfilePatch): Promise<MemberProfile> {
    return updateMyProfile(patch);
  }

  async resolveMemberByQrToken(token: string): Promise<MemberRef | null> {
    const ref = parseMemberQrToken(token);
    if (!ref) return null;
    return ref.source === 'supabase' ? ref : null;
  }

  async listMemberships(_externalId?: string): Promise<Membership[]> {
    const profile = await getMyProfile();
    if (!profile) return [];

    const summary = await getMembershipSummary(profile.id);
    if (summary.status === 'none' && !summary.planName) return [];

    return [
      {
        tier: profile.membershipTier,
        status: summary.status === 'none' ? 'expired' : summary.status,
        expiresAt: summary.expiresAt,
      },
    ];
  }

  async recordCheckIn(input: {
    memberId?: string;
    classId?: string | null;
    method?: string;
  }): Promise<CheckInResult> {

    const result = await invokeEdge<{
      success: boolean;
      memberName: string;
      checkedInAt: string;
      checkInId: string;
    }>('mb-checkin', {
      classId: input.classId ?? undefined,
    });
    return {
      id: result.checkInId,
      classId: input.classId ?? null,
      checkedInAt: result.checkedInAt,
      method: input.method ?? 'qr',
    };
  }

  async refreshPrograms() {
    return invokeEdge<{ refreshed: boolean; count?: number }>('mb-programs');
  }

  async refreshSchedule(range: { startDate: string; endDate: string; force?: boolean }) {
    return invokeEdge<{ refreshed: boolean; count?: number }>('mb-schedule', range);
  }

  async refreshCoaches(options?: { force?: boolean }) {
    return invokeEdge<{ refreshed: boolean; count?: number }>('mb-staff', options);
  }
}
