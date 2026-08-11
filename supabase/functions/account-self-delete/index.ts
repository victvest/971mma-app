import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/jwt.ts';
import { serviceClient } from '../_shared/supabase.ts';

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

/**
 * Member-initiated account deletion (App Store 5.1.1(v) / Play Data safety).
 * Deletes the signed-in auth user and associated app data after confirmation
 * on the client. Gym membership/billing in Mindbody is intentionally separate.
 */
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
    const auth = await requireUser(req);
    const userId = auth.userId;
    const svc = serviceClient();

    const { data: profile, error: profileError } = await svc
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', userId)
      .maybeSingle<{ id: string; role: string; full_name: string | null }>();

    if (profileError || !profile) {
      throw new MbError('BAD_REQUEST', 'Member profile was not found.');
    }

    if (profile.role === 'admin') {
      const { count, error: adminCountError } = await svc
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .neq('id', userId);

      if (adminCountError) {
        throw new MbError('UPSTREAM_ERROR', 'Unable to verify admin roster.');
      }

      if ((count ?? 0) < 1) {
        throw new MbError(
          'FORBIDDEN',
          'Cannot delete the last remaining admin account. Ask another admin to help.',
        );
      }
    }

    const displayName = profile.full_name;

    const { data: existingPending } = await svc
      .from('account_deletion_requests')
      .select(
        'id, user_id, status, requested_at, processed_at, notes, member_display_name, auth_deleted_at',
      )
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle<DeletionRequestRow>();

    let requestId = existingPending?.id;

    if (!requestId) {
      const { data: created, error: createError } = await svc
        .from('account_deletion_requests')
        .insert({
          user_id: userId,
          member_display_name: displayName,
          status: 'processing',
        })
        .select('id')
        .single<{ id: string }>();

      if (createError || !created) {
        throw new MbError('UPSTREAM_ERROR', 'Unable to create deletion request.');
      }
      requestId = created.id;
    } else {
      const { error: processingError } = await svc
        .from('account_deletion_requests')
        .update({
          status: 'processing',
          member_display_name: displayName ?? existingPending?.member_display_name,
        })
        .eq('id', requestId);

      if (processingError) {
        throw new MbError('UPSTREAM_ERROR', 'Unable to mark deletion as processing.');
      }
    }

    const { error: prepareError } = await svc.rpc('prepare_auth_user_deletion', {
      p_user_id: userId,
    });

    if (prepareError) {
      throw new MbError('UPSTREAM_ERROR', 'Unable to prepare account data for deletion.');
    }

    const completedAt = new Date().toISOString();

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
        processed_at: completedAt,
        auth_deleted_at: completedAt,
        member_display_name: displayName,
        notes: 'Completed via in-app self-service deletion.',
      })
      .eq('id', requestId);

    if (markCompletedError) {
      throw new MbError(
        'UPSTREAM_ERROR',
        'Auth user was deleted but the request record could not be finalized.',
      );
    }

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
