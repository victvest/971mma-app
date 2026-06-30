import { writeAdminAudit } from '../_shared/adminAudit.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireRole, requireUser } from '../_shared/jwt.ts';
import { serviceClient } from '../_shared/supabase.ts';

type AccountDeleteRequest = {
  requestId?: string;
  notes?: string;
};

type DeletionRequestRow = {
  id: string;
  user_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  requested_at: string;
  processed_at: string | null;
  notes: string | null;
  member_display_name: string | null;
  auth_deleted_at: string | null;
};

function cleanRequestId(value: string | undefined): string {
  const cleaned = value?.trim();
  if (!cleaned) {
    throw new MbError('BAD_REQUEST', 'requestId is required.');
  }
  return cleaned;
}

async function countActiveAdmins(
  svc: ReturnType<typeof serviceClient>,
  excludeUserId?: string,
): Promise<number> {
  let query = svc
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin');

  if (excludeUserId) {
    query = query.neq('id', excludeUserId);
  }

  const { count, error } = await query;
  if (error) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to verify admin roster.');
  }

  return count ?? 0;
}

async function loadDeletionRequest(
  svc: ReturnType<typeof serviceClient>,
  requestId: string,
): Promise<DeletionRequestRow> {
  const { data, error } = await svc
    .from('account_deletion_requests')
    .select(
      'id, user_id, status, requested_at, processed_at, notes, member_display_name, auth_deleted_at',
    )
    .eq('id', requestId)
    .maybeSingle<DeletionRequestRow>();

  if (error || !data) {
    throw new MbError('BAD_REQUEST', 'Deletion request was not found.');
  }

  return data;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse(
      { error: { code: 'BAD_REQUEST', message: 'POST required.' } },
      { status: 405 },
    );
  }

  try {
    const admin = await requireUser(req);
    requireRole(admin, ['admin']);

    const body = (await req.json().catch(() => ({}))) as AccountDeleteRequest;
    const requestId = cleanRequestId(body.requestId);
    const notes = body.notes?.trim() || null;
    const svc = serviceClient();

    const request = await loadDeletionRequest(svc, requestId);

    if (request.status === 'cancelled') {
      throw new MbError('BAD_REQUEST', 'Cancelled deletion requests cannot be completed.');
    }

    if (request.status === 'completed' && request.auth_deleted_at) {
      return jsonResponse({
        requestId: request.id,
        status: request.status,
        alreadyCompleted: true,
      });
    }

    const userId = request.user_id;
    if (!userId) {
      throw new MbError(
        'BAD_REQUEST',
        'This deletion request no longer has an associated auth user.',
      );
    }

    if (userId === admin.userId) {
      throw new MbError(
        'FORBIDDEN',
        'Complete your own deletion request from the mobile app or ask another admin.',
      );
    }

    const { data: targetProfile, error: profileError } = await svc
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', userId)
      .maybeSingle<{ id: string; role: string; full_name: string | null }>();

    if (profileError || !targetProfile) {
      throw new MbError('BAD_REQUEST', 'Member profile was not found.');
    }

    if (targetProfile.role === 'admin') {
      const remainingAdmins = await countActiveAdmins(svc, userId);
      if (remainingAdmins < 1) {
        throw new MbError(
          'FORBIDDEN',
          'Cannot delete the last remaining admin account.',
        );
      }
    }

    if (request.status === 'pending') {
      const { error: processingError } = await svc
        .from('account_deletion_requests')
        .update({ status: 'processing' })
        .eq('id', requestId);

      if (processingError) {
        throw new MbError('UPSTREAM_ERROR', 'Unable to mark request as processing.');
      }
    }

    const { error: prepareError } = await svc.rpc('prepare_auth_user_deletion', {
      p_user_id: userId,
    });

    if (prepareError) {
      throw new MbError('UPSTREAM_ERROR', 'Unable to prepare account data for deletion.');
    }

    const completedAt = new Date().toISOString();
    const displayName = request.member_display_name ?? targetProfile.full_name;

    const { error: deleteError } = await svc.auth.admin.deleteUser(userId);
    if (deleteError) {
      throw new MbError(
        'UPSTREAM_ERROR',
        deleteError.message || 'Unable to delete auth user.',
      );
    }

    const { error: markCompletedError } = await svc
      .from('account_deletion_requests')
      .update({
        status: 'completed',
        processed_at: request.processed_at ?? completedAt,
        auth_deleted_at: completedAt,
        notes: notes ?? request.notes,
        member_display_name: displayName,
      })
      .eq('id', requestId);

    if (markCompletedError) {
      throw new MbError(
        'UPSTREAM_ERROR',
        'Auth user was deleted but the request record could not be finalized.',
      );
    }

    await writeAdminAudit(svc, admin.userId, 'complete_account_deletion', 'account_deletion_requests', requestId, {
      deletedUserId: userId,
      memberDisplayName: displayName,
    });

    return jsonResponse({
      requestId,
      status: 'completed',
      deletedUserId: userId,
      authDeletedAt: completedAt,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
