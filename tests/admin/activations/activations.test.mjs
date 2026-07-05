/**
 * Admin panel — Account activation requests.
 *
 * New members request activation; staff approve them, flipping account_status to
 * active (which unlocks the full app). Drives the real member→admin flow end to
 * end with an ephemeral member.
 */
import { suite, test, assert, assertEqual } from '../../lib/framework.mjs';

suite('Admin / activations', () => {
  test('member requests activation → admin sees it → approval activates the account', async (ctx) => {
    const m = await ctx.createEphemeralMember({ fullName: 'Pending Member', accountStatus: 'registered' });
    try {
      // Member side: request activation.
      const { token } = await ctx.signInRaw(m.email, m.password);
      const req = await ctx.rpcAs(token, 'request_account_activation', {});
      assert(req.ok, `request_account_activation failed: ${JSON.stringify(req.error)}`);

      const reqRow = ctx.runSql(
        `select id::text as id, status from public.activation_requests where user_id = '${m.userId}' limit 1;`,
      )[0];
      assert(reqRow, 'an activation_requests row must exist');

      // Admin side: it appears in the listing.
      await ctx.setRole('admin');
      const list = await ctx.h.supabase.rpc('admin_list_activation_requests', {
        p_status: null,
        p_limit: 100,
        p_offset: 0,
      });
      assert(!list.error, `admin_list_activation_requests failed: ${list.error?.message}`);
      assert((list.data ?? []).some((r) => r.user_id === m.userId), 'request must appear to admin');

      // Resolve the request. Valid statuses are pending|resolved|cancelled.
      // NOTE: resolving the queue item is the staff acknowledgement; the actual
      // account ACTIVATION happens when staff link the member in Mindbody
      // (mb-link-* sets account_status='active'). See TEST-NOTES.
      const resolve = await ctx.h.supabase.rpc('admin_update_activation_request', {
        p_id: reqRow.id,
        p_status: 'resolved',
      });
      assert(!resolve.error, `admin_update_activation_request failed: ${resolve.error?.message}`);

      const resolved = ctx.runSql(
        `select status, resolved_at from public.activation_requests where id = '${reqRow.id}'::uuid;`,
      )[0];
      assertEqual(resolved?.status, 'resolved', 'request must be marked resolved');
      assert(resolved?.resolved_at, 'resolved_at must be stamped');
    } finally {
      ctx.runSql(`delete from public.activation_requests where user_id = '${m.userId}';`);
      await ctx.deleteEphemeralUser(m.userId);
    }
  }, { role: 'admin', multiRole: true });
});
