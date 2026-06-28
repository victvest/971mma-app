import { getSupabaseClient } from '@/services/supabase/client';
import type { MemberMembershipRow, ProfileRow } from '@/types/database';
import type { MemberMembershipItem, MembershipSummary } from '@/types/domain';

const MEMBERSHIP_COLUMNS =
  'id, user_id, record_kind, mindbody_record_id, mindbody_contract_id, mindbody_membership_id, name, status, start_date, end_date, auto_renew, source, last_synced_at';

function mapMembershipRow(row: MemberMembershipRow): MemberMembershipItem {
  return {
    id: row.id,
    userId: row.user_id,
    recordKind: row.record_kind,
    mindbodyRecordId: row.mindbody_record_id,
    mindbodyContractId: row.mindbody_contract_id,
    mindbodyMembershipId: row.mindbody_membership_id,
    name: row.name,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    autoRenew: row.auto_renew,
    source: row.source,
    lastSyncedAt: row.last_synced_at,
  };
}

export async function getMemberMemberships(userId: string): Promise<MemberMembershipItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('member_memberships')
    .select(MEMBERSHIP_COLUMNS)
    .eq('user_id', userId)
    .order('end_date', { ascending: false, nullsFirst: false });

  if (error) throw error;
  return (data as MemberMembershipRow[]).map(mapMembershipRow);
}

export async function getMembershipSummary(userId: string): Promise<MembershipSummary> {
  const [{ data: profile, error: profileError }, memberships] = await Promise.all([
    getSupabaseClient()
      .from('profiles')
      .select(
        'membership_name, membership_status, membership_expires_at, membership_source, membership_last_synced_at',
      )
      .eq('id', userId)
      .maybeSingle<
        Pick<
          ProfileRow,
          | 'membership_name'
          | 'membership_status'
          | 'membership_expires_at'
          | 'membership_source'
          | 'membership_last_synced_at'
        >
      >(),
    getMemberMemberships(userId),
  ]);

  if (profileError) throw profileError;

  const status =
    memberships.length === 0
      ? 'none'
      : profile?.membership_status === 'active' ||
          profile?.membership_status === 'paused' ||
          profile?.membership_status === 'expired'
        ? profile.membership_status
        : 'active';

  const primary =
    memberships.find((item) => item.status === 'active') ??
    memberships.find((item) => item.status === 'paused') ??
    memberships[0] ??
    null;

  return {
    planName: profile?.membership_name ?? primary?.name ?? null,
    status,
    expiresAt: profile?.membership_expires_at ?? primary?.endDate ?? null,
    autoRenew: primary?.autoRenew ?? false,
    source: profile?.membership_source === 'mindbody' ? 'mindbody' : null,
    lastSyncedAt: profile?.membership_last_synced_at ?? null,
    records: memberships,
  };
}
