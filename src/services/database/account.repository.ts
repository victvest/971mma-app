import { getSupabaseClient } from '@/services/supabase/client';

export type AccountDeletionRequest = {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  requestedAt: string;
  processedAt: string | null;
  notes: string | null;
};

type AccountDeletionRequestRow = {
  id: string;
  user_id: string;
  status: AccountDeletionRequest['status'];
  requested_at: string;
  processed_at: string | null;
  notes: string | null;
};

function mapRow(row: AccountDeletionRequestRow): AccountDeletionRequest {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    requestedAt: row.requested_at,
    processedAt: row.processed_at,
    notes: row.notes,
  };
}

/** Submit (or return existing) pending account deletion request. Does not delete the account. */
export async function requestAccountDeletion(): Promise<AccountDeletionRequest> {
  const { data, error } = await getSupabaseClient().rpc('request_account_deletion');

  if (error) throw error;
  return mapRow(data as AccountDeletionRequestRow);
}
