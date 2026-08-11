import { jsonResponse, withCors } from '../_shared/cors.ts';
import { writeAdminAudit } from '../_shared/adminAudit.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireRole, requireUser } from '../_shared/jwt.ts';
import { serviceClient } from '../_shared/supabase.ts';

type UnlinkRequest = {
  userId?: string;
};

function cleanId(value: string | undefined): string {
  const cleaned = value?.trim();
  if (!cleaned) throw new MbError('BAD_REQUEST', 'userId is required.');
  return cleaned;
}

Deno.serve((req) =>
  withCors(req, async () => {
    if (req.method !== 'POST') {
      return jsonResponse(
        { error: { code: 'BAD_REQUEST', message: 'POST required.' } },
        { status: 405 },
      );
    }

    try {
      const admin = await requireUser(req);
      requireRole(admin, ['admin']);

      const body = (await req.json().catch(() => ({}))) as UnlinkRequest;
      const userId = cleanId(body.userId);
      const svc = serviceClient();

      const { data: link, error: linkError } = await svc
        .from('mindbody_links')
        .select('user_id, mindbody_client_id, mindbody_unique_id, link_method')
        .eq('user_id', userId)
        .maybeSingle<{
          user_id: string;
          mindbody_client_id: string;
          mindbody_unique_id: string | null;
          link_method: string;
        }>();

      if (linkError) {
        throw new MbError('UPSTREAM_ERROR', 'Unable to read Mindbody link.');
      }
      if (!link) {
        throw new MbError('NOT_LINKED', 'This member is not linked to Mindbody.');
      }

      const { error: deleteLinkError } = await svc
        .from('mindbody_links')
        .delete()
        .eq('user_id', userId);
      if (deleteLinkError) {
        throw new MbError('UPSTREAM_ERROR', 'Unable to remove Mindbody link.');
      }

      await svc.from('member_memberships').delete().eq('user_id', userId);

      const { error: profileError } = await svc
        .from('profiles')
        .update({
          account_status: 'activation_required',
          membership_name: null,
          membership_status: null,
          membership_expires_at: null,
          membership_source: null,
          membership_last_synced_at: null,
          mindbody_synced_at: null,
        })
        .eq('id', userId);

      if (profileError) {
        throw new MbError('UPSTREAM_ERROR', 'Unable to update member activation status.');
      }

      await writeAdminAudit(svc, admin.userId, 'unlink_mindbody', 'mindbody_links', userId, {
        mindbodyClientId: link.mindbody_client_id,
        mindbodyUniqueId: link.mindbody_unique_id,
        previousLinkMethod: link.link_method,
      });

      return jsonResponse({
        userId,
        clientId: link.mindbody_client_id,
        unlinkedBy: admin.userId,
        accountStatus: 'activation_required',
      });
    } catch (error) {
      return toErrorResponse(error);
    }
  }),
);
