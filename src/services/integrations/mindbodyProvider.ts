import { parseMemberQrToken } from '@/services/qr/token';
import type {
  CheckInResult,
  MemberProfile,
  MemberRef,
  Membership,
  ProfilePatch,
} from '@/types/domain';
import type { IntegrationProvider, ProviderSource } from './types';

const NOT_CONFIGURED =
  'Direct Mindbody access is disabled. Use the Supabase Edge Function provider.';

export class MindbodyProvider implements IntegrationProvider {
  readonly source: ProviderSource = 'mindbody';

  private async ensureAuth(): Promise<void> {
    throw new Error(NOT_CONFIGURED);
  }

  async getMemberProfile(_externalId?: string): Promise<MemberProfile | null> {
    await this.ensureAuth();
    return null;
  }

  async updateMemberProfile(_patch: ProfilePatch): Promise<MemberProfile> {
    await this.ensureAuth();
    throw new Error(NOT_CONFIGURED);
  }

  async resolveMemberByQrToken(token: string): Promise<MemberRef | null> {
    const ref = parseMemberQrToken(token);
    if (!ref || ref.source !== 'mindbody') return null;
    return ref;
  }

  async listMemberships(_externalId?: string): Promise<Membership[]> {
    await this.ensureAuth();
    return [];
  }

  async recordCheckIn(_input: {
    memberId?: string;
    classId?: string | null;
    method?: string;
  }): Promise<CheckInResult> {
    await this.ensureAuth();
    throw new Error(NOT_CONFIGURED);
  }

  async refreshPrograms() {
    await this.ensureAuth();
    return { refreshed: false };
  }

  async refreshSchedule(_range: {
    startDate: string;
    endDate: string;
    force?: boolean;
  }): Promise<{ refreshed: boolean; count?: number }> {
    await this.ensureAuth();
    throw new Error(NOT_CONFIGURED);
  }

  async refreshCoaches(_options?: { force?: boolean }): Promise<{ refreshed: boolean; count?: number }> {
    await this.ensureAuth();
    throw new Error(NOT_CONFIGURED);
  }
}
