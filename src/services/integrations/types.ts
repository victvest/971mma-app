

import type {
  CheckInResult,
  MemberProfile,
  MemberRef,
  Membership,
  ProfilePatch,
} from '@/types/domain';

export type ProviderSource = 'supabase' | 'mindbody';

export interface MemberProvider {
  readonly source: ProviderSource;
  getMemberProfile(externalId?: string): Promise<MemberProfile | null>;
  updateMemberProfile(patch: ProfilePatch, externalId?: string): Promise<MemberProfile>;
  resolveMemberByQrToken(token: string): Promise<MemberRef | null>;
  listMemberships(externalId?: string): Promise<Membership[]>;
}

export interface CheckInProvider {
  readonly source: ProviderSource;
  recordCheckIn(input: {
    memberId?: string;
    classId?: string | null;
    method?: string;
  }): Promise<CheckInResult>;
}

export interface ScheduleProvider {
  readonly source: ProviderSource;
  refreshPrograms(): Promise<{ refreshed: boolean; count?: number }>;
  refreshSchedule(range: {
    startDate: string;
    endDate: string;
    force?: boolean;
  }): Promise<{ refreshed: boolean; count?: number }>;
}

export interface DirectoryProvider {
  readonly source: ProviderSource;
  refreshCoaches(options?: { force?: boolean }): Promise<{ refreshed: boolean; count?: number }>;
}

export interface IntegrationProvider
  extends MemberProvider, CheckInProvider, ScheduleProvider, DirectoryProvider {}
