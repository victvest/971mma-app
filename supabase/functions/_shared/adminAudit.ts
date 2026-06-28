import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

type AuditMetadata = Record<string, unknown>;

export async function writeAdminAudit(
  svc: SupabaseClient,
  actorId: string,
  action: string,
  targetTable: string,
  targetId: string,
  metadata?: AuditMetadata,
): Promise<void> {
  const { error } = await svc.from('admin_audit_log').insert({
    actor_id: actorId,
    action,
    target_table: targetTable,
    target_id: targetId,
    metadata: metadata ?? {},
  });

  if (error) {
    throw new Error(`Unable to write admin audit log: ${error.message}`);
  }
}
