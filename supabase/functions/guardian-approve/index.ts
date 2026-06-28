import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { writeAdminAudit } from '../_shared/adminAudit.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireRole, requireUser } from '../_shared/jwt.ts';
import { mbFetch } from '../_shared/mindbody.ts';
import { serviceClient } from '../_shared/supabase.ts';

type AccountMode = 'managed' | 'independent';

type GuardianApproveRequest = {
  action?:
    | 'approve'
    | 'reject'
    | 'revoke'
    | 'list_pending'
    | 'create_direct'
    | 'update_link';
  linkId?: string;
  guardianUserId?: string;
  traineeUserId?: string;
  childDisplayName?: string;
  accountMode?: AccountMode;
  allowGuardianQr?: boolean;
  mindbodyClientId?: string;
  reason?: string;
  childDateOfBirth?: string;
  childEmail?: string;
  childPhone?: string;
  requestNotes?: string;
};

type GuardianLinkRow = {
  id: string;
  guardian_user_id: string;
  trainee_user_id: string | null;
  status: string;
  child_display_name: string;
  child_date_of_birth: string | null;
  child_email: string | null;
  child_phone: string | null;
  mindbody_client_id: string | null;
  request_notes: string | null;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  account_mode: AccountMode;
  allow_guardian_qr: boolean;
  child_avatar_url: string | null;
};

type MbClient = {
  Id?: unknown;
  UniqueId?: unknown;
};

type ClientSearchResponse = {
  Clients?: MbClient[];
};

function cleanId(value: string | undefined, label: string): string {
  const cleaned = value?.trim();
  if (!cleaned) throw new MbError('BAD_REQUEST', `${label} is required.`);
  return cleaned;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function normalizeAccountMode(value: string | undefined, fallback: AccountMode = 'managed'): AccountMode {
  const mode = value?.trim().toLowerCase();
  if (mode === 'independent') return 'independent';
  if (mode === 'managed') return 'managed';
  return fallback;
}

function allowGuardianQrForMode(mode: AccountMode, explicit?: boolean): boolean {
  if (mode === 'managed') return true;
  return explicit === true;
}

async function isManagedTraineeUser(
  svc: ReturnType<typeof serviceClient>,
  traineeUserId: string,
): Promise<boolean> {
  const { data, error } = await svc.auth.admin.getUserById(traineeUserId);
  if (error || !data.user?.email) return false;
  return data.user.email.endsWith('@971mma-managed.local');
}

async function inferAccountMode(
  svc: ReturnType<typeof serviceClient>,
  traineeUserId: string,
  explicit?: AccountMode,
): Promise<AccountMode> {
  if (explicit) return explicit;
  return (await isManagedTraineeUser(svc, traineeUserId)) ? 'managed' : 'independent';
}

async function fetchMindbodyClient(clientId: string): Promise<{ clientId: string; uniqueId: string | null }> {
  const query = new URLSearchParams({
    'request.clientIDs': clientId,
    'request.includeInactive': 'true',
  });
  const response = await mbFetch<ClientSearchResponse>(
    serviceClient(),
    `/client/clients?${query.toString()}`,
  );
  const client = (response.Clients ?? []).find((row) => asString(row.Id) === clientId);

  if (!client) {
    throw new MbError('NOT_LINKED', 'Mindbody client was not found.');
  }

  return {
    clientId,
    uniqueId: asString(client.UniqueId),
  };
}

async function ensureTraineeProfile(
  svc: ReturnType<typeof serviceClient>,
  traineeUserId: string,
  displayName: string,
  avatarUrl?: string | null,
): Promise<void> {
  const { data: profile, error } = await svc
    .from('profiles')
    .select('id')
    .eq('id', traineeUserId)
    .maybeSingle<{ id: string }>();

  if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to read trainee profile.');

  const cleanedAvatar = avatarUrl?.trim() || null;

  if (!profile) {
    const { error: insertError } = await svc.from('profiles').insert({
      id: traineeUserId,
      full_name: displayName,
      role: 'member',
      avatar_url: cleanedAvatar,
    });
    if (insertError) {
      throw new MbError('UPSTREAM_ERROR', 'Unable to create trainee profile.');
    }
    return;
  }

  const patch: Record<string, string> = { full_name: displayName };
  if (cleanedAvatar) {
    patch.avatar_url = cleanedAvatar;
  }

  const { error: updateError } = await svc
    .from('profiles')
    .update(patch)
    .eq('id', traineeUserId);

  if (updateError) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to update trainee profile.');
  }
}

async function createManagedTraineeUser(
  svc: ReturnType<typeof serviceClient>,
  link: Pick<GuardianLinkRow, 'id' | 'child_display_name' | 'child_avatar_url'>,
): Promise<string> {
  const email = `trainee+${link.id}@971mma-managed.local`;
  const password = crypto.randomUUID();

  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: link.child_display_name,
      managed_trainee: true,
    },
  });

  if (error || !data.user?.id) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to create managed trainee account.');
  }

  await ensureTraineeProfile(svc, data.user.id, link.child_display_name, link.child_avatar_url);
  return data.user.id;
}

async function resolveTraineeUserId(
  svc: ReturnType<typeof serviceClient>,
  link: Pick<GuardianLinkRow, 'id' | 'child_display_name' | 'child_avatar_url'>,
  traineeUserId?: string,
): Promise<string> {
  const explicit = traineeUserId?.trim();
  if (explicit) {
    await ensureTraineeProfile(svc, explicit, link.child_display_name, link.child_avatar_url);
    return explicit;
  }

  return createManagedTraineeUser(svc, link);
}

async function linkTraineeMindbody(
  svc: ReturnType<typeof serviceClient>,
  traineeUserId: string,
  mindbodyClientId: string,
): Promise<void> {
  const mbClient = await fetchMindbodyClient(mindbodyClientId);
  const { error } = await svc.from('mindbody_links').upsert({
    user_id: traineeUserId,
    mindbody_client_id: mbClient.clientId,
    mindbody_unique_id: mbClient.uniqueId,
    link_method: 'manual',
  });

  if (error) {
    const conflict = error.code === '23505';
    throw new MbError(
      conflict ? 'AMBIGUOUS_MATCH' : 'UPSTREAM_ERROR',
      conflict
        ? 'This Mindbody client is already linked to another account.'
        : 'Unable to store trainee Mindbody link.',
    );
  }

  await svc
    .from('profiles')
    .update({ mindbody_synced_at: new Date().toISOString() })
    .eq('id', traineeUserId);
}

async function assertNoConflictingTraineeLink(
  svc: ReturnType<typeof serviceClient>,
  guardianUserId: string,
  traineeUserId: string,
  excludeLinkId?: string,
): Promise<void> {
  let query = svc
    .from('guardian_links')
    .select('id')
    .eq('guardian_user_id', guardianUserId)
    .eq('trainee_user_id', traineeUserId)
    .eq('status', 'approved');

  if (excludeLinkId) {
    query = query.neq('id', excludeLinkId);
  }

  const { data, error } = await query.maybeSingle<{ id: string }>();
  if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to verify guardian link uniqueness.');
  if (data) {
    throw new MbError('AMBIGUOUS_MATCH', 'This guardian is already linked to that trainee.');
  }
}

async function approveGuardianLink(
  svc: ReturnType<typeof serviceClient>,
  adminUserId: string,
  link: GuardianLinkRow,
  options: {
    traineeUserId?: string;
    mindbodyClientId?: string | null;
    accountMode?: AccountMode;
    allowGuardianQr?: boolean;
  },
): Promise<{ traineeUserId: string; mindbodyLinked: boolean; approvedAt: string }> {
  const traineeUserId = await resolveTraineeUserId(svc, link, options.traineeUserId);
  await assertNoConflictingTraineeLink(svc, link.guardian_user_id, traineeUserId, link.id);

  const accountMode = await inferAccountMode(svc, traineeUserId, options.accountMode ?? link.account_mode);
  const allowGuardianQr = allowGuardianQrForMode(accountMode, options.allowGuardianQr ?? link.allow_guardian_qr);
  const mindbodyClientId = options.mindbodyClientId?.trim() || link.mindbody_client_id?.trim() || null;

  if (mindbodyClientId) {
    await linkTraineeMindbody(svc, traineeUserId, mindbodyClientId);
  }

  const approvedAt = new Date().toISOString();
  const { error: updateError } = await svc
    .from('guardian_links')
    .update({
      trainee_user_id: traineeUserId,
      status: 'approved',
      approved_by: adminUserId,
      approved_at: approvedAt,
      rejected_reason: null,
      account_mode: accountMode,
      allow_guardian_qr: allowGuardianQr,
    })
    .eq('id', link.id);

  if (updateError) {
    const conflict = updateError.code === '23505';
    throw new MbError(
      conflict ? 'AMBIGUOUS_MATCH' : 'UPSTREAM_ERROR',
      conflict
        ? 'This guardian is already linked to that trainee.'
        : 'Unable to approve guardian link.',
    );
  }

  return { traineeUserId, mindbodyLinked: Boolean(mindbodyClientId), approvedAt };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: { code: 'BAD_REQUEST', message: 'POST required.' } }, { status: 405 });
  }

  try {
    const admin = await requireUser(req);
    requireRole(admin, ['admin']);

    const body = (await req.json().catch(() => ({}))) as GuardianApproveRequest;
    const action = body.action ?? 'list_pending';
    const svc = serviceClient();

    if (action === 'list_pending') {
      const { data, error } = await svc
        .from('guardian_links')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at', { ascending: true });

      if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to list pending guardian links.');
      return jsonResponse({ links: data ?? [] });
    }

    if (action === 'create_direct') {
      const guardianUserId = cleanId(body.guardianUserId, 'guardianUserId');
      const childDisplayName = body.childDisplayName?.trim();
      if (!childDisplayName) {
        throw new MbError('BAD_REQUEST', 'childDisplayName is required.');
      }

      const accountMode = normalizeAccountMode(body.accountMode, 'managed');
      const allowGuardianQr = allowGuardianQrForMode(accountMode, body.allowGuardianQr);

      const { data: inserted, error: insertError } = await svc
        .from('guardian_links')
        .insert({
          guardian_user_id: guardianUserId,
          status: 'pending',
          child_display_name: childDisplayName,
          child_date_of_birth: body.childDateOfBirth?.trim() || null,
          child_email: body.childEmail?.trim() || null,
          child_phone: body.childPhone?.trim() || null,
          mindbody_client_id: body.mindbodyClientId?.trim() || null,
          request_notes: body.requestNotes?.trim() || 'Created by admin.',
          account_mode: accountMode,
          allow_guardian_qr: allowGuardianQr,
        })
        .select('*')
        .single<GuardianLinkRow>();

      if (insertError || !inserted) {
        throw new MbError('UPSTREAM_ERROR', 'Unable to create guardian link.');
      }

      const approved = await approveGuardianLink(svc, admin.userId, inserted, {
        traineeUserId: body.traineeUserId,
        mindbodyClientId: body.mindbodyClientId,
        accountMode,
        allowGuardianQr,
      });

      await writeAdminAudit(svc, admin.userId, 'create_guardian_link', 'guardian_links', inserted.id, {
        guardianUserId,
        traineeUserId: approved.traineeUserId,
        accountMode,
        allowGuardianQr,
        mindbodyLinked: approved.mindbodyLinked,
      });

      return jsonResponse({
        success: true,
        linkId: inserted.id,
        status: 'approved',
        traineeUserId: approved.traineeUserId,
        accountMode,
        allowGuardianQr,
        mindbodyLinked: approved.mindbodyLinked,
        approvedAt: approved.approvedAt,
      });
    }

    const linkId = cleanId(body.linkId, 'linkId');
    const { data: link, error: linkError } = await svc
      .from('guardian_links')
      .select('*')
      .eq('id', linkId)
      .maybeSingle<GuardianLinkRow>();

    if (linkError || !link) {
      throw new MbError('NOT_FOUND', 'Guardian link request was not found.');
    }

    if (action === 'update_link') {
      if (link.status !== 'approved') {
        throw new MbError('BAD_REQUEST', 'Only approved links can be updated.');
      }

      const patch: Record<string, unknown> = {};
      if (body.childDisplayName?.trim()) patch.child_display_name = body.childDisplayName.trim();
      if (body.childEmail !== undefined) patch.child_email = body.childEmail?.trim() || null;
      if (body.childPhone !== undefined) patch.child_phone = body.childPhone?.trim() || null;
      if (body.requestNotes !== undefined) patch.request_notes = body.requestNotes?.trim() || null;
      if (body.mindbodyClientId?.trim()) patch.mindbody_client_id = body.mindbodyClientId.trim();

      let traineeUserId = link.trainee_user_id;
      if (body.traineeUserId?.trim()) {
        traineeUserId = body.traineeUserId.trim();
        await ensureTraineeProfile(
          svc,
          traineeUserId,
          body.childDisplayName?.trim() || link.child_display_name,
          link.child_avatar_url,
        );
        await assertNoConflictingTraineeLink(svc, link.guardian_user_id, traineeUserId, link.id);
        patch.trainee_user_id = traineeUserId;
      }

      const accountMode = body.accountMode
        ? normalizeAccountMode(body.accountMode)
        : link.account_mode;
      patch.account_mode = accountMode;
      patch.allow_guardian_qr = allowGuardianQrForMode(
        accountMode,
        body.allowGuardianQr ?? link.allow_guardian_qr,
      );

      if (Object.keys(patch).length === 0 && !body.mindbodyClientId?.trim()) {
        throw new MbError('BAD_REQUEST', 'No updates provided.');
      }

      if (Object.keys(patch).length > 0) {
        const { error: updateError } = await svc.from('guardian_links').update(patch).eq('id', linkId);
        if (updateError) throw new MbError('UPSTREAM_ERROR', 'Unable to update guardian link.');
      }

      if (body.mindbodyClientId?.trim() && traineeUserId) {
        await linkTraineeMindbody(svc, traineeUserId, body.mindbodyClientId.trim());
      }

      await writeAdminAudit(svc, admin.userId, 'update_guardian_link', 'guardian_links', linkId, {
        patch,
        mindbodyUpdated: Boolean(body.mindbodyClientId?.trim()),
      });

      return jsonResponse({ success: true, linkId, status: link.status });
    }

    if (action === 'reject') {
      if (link.status !== 'pending') {
        throw new MbError('BAD_REQUEST', 'Only pending requests can be rejected.');
      }

      const { error: updateError } = await svc
        .from('guardian_links')
        .update({
          status: 'rejected',
          rejected_reason: body.reason?.trim() || 'Rejected by admin.',
          approved_by: admin.userId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', linkId);

      if (updateError) throw new MbError('UPSTREAM_ERROR', 'Unable to reject guardian link.');
      await writeAdminAudit(svc, admin.userId, 'reject_guardian_link', 'guardian_links', linkId, {
        reason: body.reason?.trim() || 'Rejected by admin.',
      });
      return jsonResponse({ success: true, linkId, status: 'rejected' });
    }

    if (action === 'revoke') {
      if (link.status !== 'approved') {
        throw new MbError('BAD_REQUEST', 'Only approved links can be revoked.');
      }

      const { error: updateError } = await svc
        .from('guardian_links')
        .update({
          status: 'revoked',
          rejected_reason: body.reason?.trim() || 'Revoked by admin.',
          approved_by: admin.userId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', linkId);

      if (updateError) throw new MbError('UPSTREAM_ERROR', 'Unable to revoke guardian link.');
      await writeAdminAudit(svc, admin.userId, 'revoke_guardian_link', 'guardian_links', linkId, {
        reason: body.reason?.trim() || 'Revoked by admin.',
      });
      return jsonResponse({ success: true, linkId, status: 'revoked' });
    }

    if (action === 'approve') {
      if (link.status !== 'pending') {
        throw new MbError('BAD_REQUEST', 'Only pending requests can be approved.');
      }

      const approved = await approveGuardianLink(svc, admin.userId, link, {
        traineeUserId: body.traineeUserId,
        mindbodyClientId: body.mindbodyClientId ?? link.mindbody_client_id,
        accountMode: body.accountMode ? normalizeAccountMode(body.accountMode) : link.account_mode,
        allowGuardianQr: body.allowGuardianQr,
      });

      await writeAdminAudit(svc, admin.userId, 'approve_guardian_link', 'guardian_links', linkId, {
        traineeUserId: approved.traineeUserId,
        accountMode: body.accountMode ?? link.account_mode,
        allowGuardianQr: body.allowGuardianQr ?? link.allow_guardian_qr,
        mindbodyLinked: approved.mindbodyLinked,
      });

      return jsonResponse({
        success: true,
        linkId,
        status: 'approved',
        traineeUserId: approved.traineeUserId,
        mindbodyLinked: approved.mindbodyLinked,
        approvedBy: admin.userId,
        approvedAt: approved.approvedAt,
      });
    }

    throw new MbError('BAD_REQUEST', 'Unsupported action.');
  } catch (error) {
    return toErrorResponse(error);
  }
});
