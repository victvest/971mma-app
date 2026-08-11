import { invokeEdge } from '@/services/mindbody/edgeClient';
import { getSupabaseClient } from '@/services/supabase/client';

export type AccountDeletionRequest = {
  id: string;
  userId: string | null;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  requestedAt: string;
  processedAt: string | null;
  authDeletedAt: string | null;
  memberDisplayName: string | null;
  notes: string | null;
};

export type AccountSelfDeleteResult = {
  requestId: string;
  status: 'completed';
  deletedUserId: string;
  authDeletedAt: string;
};

type AccountDeletionRequestRow = {
  id: string;
  user_id: string | null;
  status: AccountDeletionRequest['status'];
  requested_at: string;
  processed_at: string | null;
  auth_deleted_at: string | null;
  member_display_name: string | null;
  notes: string | null;
};

function mapRow(row: AccountDeletionRequestRow): AccountDeletionRequest {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    requestedAt: row.requested_at,
    processedAt: row.processed_at,
    authDeletedAt: row.auth_deleted_at,
    memberDisplayName: row.member_display_name,
    notes: row.notes,
  };
}

/**
 * Permanently deletes the signed-in app account (Auth user + app data).
 * Required for App Store Guideline 5.1.1(v) and Play Data safety.
 */
export async function deleteMyAccount(): Promise<AccountSelfDeleteResult> {
  return invokeEdge<AccountSelfDeleteResult>('account-self-delete', {});
}

/** @deprecated Prefer deleteMyAccount for store compliance. Staff queue only. */
export async function requestAccountDeletion(): Promise<AccountDeletionRequest> {
  const { data, error } = await getSupabaseClient().rpc('request_account_deletion');

  if (error) throw error;
  return mapRow(data as AccountDeletionRequestRow);
}

export type ActivationRequest = {
  id: string;
  userId: string;
  status: 'pending' | 'resolved' | 'cancelled';
  requestedAt: string;
  resolvedAt: string | null;
};

type ActivationRequestRow = {
  id: string;
  user_id: string;
  status: ActivationRequest['status'];
  requested_at: string;
  resolved_at: string | null;
};

function mapActivationRow(row: ActivationRequestRow): ActivationRequest {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    requestedAt: row.requested_at,
    resolvedAt: row.resolved_at,
  };
}

export async function getMyActivationRequest(): Promise<ActivationRequest | null> {
  const { data, error } = await getSupabaseClient()
    .from('activation_requests')
    .select('id, user_id, status, requested_at, resolved_at')
    .maybeSingle<ActivationRequestRow>();

  if (error) throw error;
  return data ? mapActivationRow(data) : null;
}

/** Submit (or return existing) activation help request for staff follow-up. */
export async function requestAccountActivation(): Promise<ActivationRequest> {
  const { data, error } = await getSupabaseClient().rpc('request_account_activation');

  if (error) throw error;
  return mapActivationRow(data as ActivationRequestRow);
}
