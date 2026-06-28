import { getSupabaseClient } from '@/services/supabase/client';
import type { GuardianLinkRow, ProfileRow } from '@/types/database';
import type { GuardianLinkItem } from '@/types/domain';

export type ProfileSummary = {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  beltRank: string | null;
};

export type ProfileSummaryMap = Record<string, ProfileSummary>;

function mapGuardianLinkRow(row: GuardianLinkRow): GuardianLinkItem {
  return {
    id: row.id,
    guardianUserId: row.guardian_user_id,
    traineeUserId: row.trainee_user_id,
    status: row.status,
    childDisplayName: row.child_display_name,
    childDateOfBirth: row.child_date_of_birth,
    childEmail: row.child_email,
    childPhone: row.child_phone,
    mindbodyClientId: row.mindbody_client_id,
    requestNotes: row.request_notes,
    requestedAt: row.requested_at,
    approvedAt: row.approved_at,
    rejectedReason: row.rejected_reason,
    accountMode: row.account_mode ?? 'managed',
    allowGuardianQr: row.allow_guardian_qr ?? true,
    childAvatarUrl: row.child_avatar_url ?? null,
  };
}

export async function getMyGuardianLinks(): Promise<GuardianLinkItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('guardian_links')
    .select('*')
    .order('requested_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as GuardianLinkRow[]).map(mapGuardianLinkRow);
}

export async function getProfileSummary(userId: string): Promise<{
  fullName: string;
  avatarUrl: string | null;
  beltRank: string | null;
}> {
  const summaries = await getProfileSummaries([userId]);
  const summary = summaries[userId];

  if (!summary) {
    return {
      fullName: 'Trainee',
      avatarUrl: null,
      beltRank: null,
    };
  }

  return {
    fullName: summary.fullName,
    avatarUrl: summary.avatarUrl,
    beltRank: summary.beltRank,
  };
}

export async function getProfileSummaries(userIds: readonly string[]): Promise<ProfileSummaryMap> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('id, full_name, avatar_url, belt_rank')
    .in('id', uniqueIds);

  if (error) throw error;

  const rows = (data ?? []) as Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url' | 'belt_rank'>[];

  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      {
        userId: row.id,
        fullName: row.full_name?.trim() || 'Trainee',
        avatarUrl: row.avatar_url ?? null,
        beltRank: row.belt_rank ?? null,
      } satisfies ProfileSummary,
    ]),
  );
}

export async function getMyGuardians(): Promise<
  Array<{
    linkId: string;
    guardianUserId: string;
    guardianName: string;
    accountMode: 'managed' | 'independent';
    allowGuardianQr: boolean;
    approvedAt: string | null;
  }>
> {
  const { data, error } = await getSupabaseClient().rpc('get_my_guardians');
  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    linkId: String(row.link_id),
    guardianUserId: String(row.guardian_user_id),
    guardianName: String(row.guardian_name ?? 'Guardian'),
    accountMode: (row.account_mode as 'managed' | 'independent') ?? 'managed',
    allowGuardianQr: Boolean(row.allow_guardian_qr),
    approvedAt: row.approved_at ? String(row.approved_at) : null,
  }));
}

export async function revokeGuardianLink(linkId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('guardian_links')
    .update({ status: 'revoked' })
    .eq('id', linkId)
    .eq('status', 'approved');

  if (error) throw error;
}
