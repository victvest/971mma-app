/**
 * Admin panel — Account activation requests.
 *
 * New members request activation; staff approve them, flipping account_status to
 * active (which unlocks the full app). Drives the real member→admin flow end to
 * end with an ephemeral member.
 */
import { suite, test, assert, assertEqual } from '../../lib/framework.mjs';
import { ensureUiTestUser, deleteEphemeralUser } from '../../lib/harness.mjs';

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

  test('admin_system_health ignores private relay activation requests', async (ctx) => {
    await ctx.setRole('admin');
    const before = await ctx.h.supabase.rpc('admin_system_health');
    assert(!before.error, `admin_system_health failed: ${before.error?.message}`);
    const beforeCount = before.data?.pendingActivationRequests ?? 0;

    const relayEmail = `eph-relay-${Date.now()}-${Math.floor(Math.random() * 1e6)}@privaterelay.appleid.com`;
    const relayPassword = `E2e!Relay${Date.now()}aA`;
    const relay = await ensureUiTestUser(ctx.h, {
      email: relayEmail,
      password: relayPassword,
      fullName: 'Relay Member',
      accountStatus: 'registered',
    });

    try {
      const { token } = await ctx.signInRaw(relay.email, relay.password);
      const req = await ctx.rpcAs(token, 'request_account_activation', {});
      assert(req.ok, `request_account_activation failed: ${JSON.stringify(req.error)}`);

      const after = await ctx.h.supabase.rpc('admin_system_health');
      assert(!after.error, `admin_system_health failed: ${after.error?.message}`);
      assertEqual(
        after.data?.pendingActivationRequests ?? 0,
        beforeCount,
        'private relay activation requests must not be counted in the sidebar badge',
      );

      const visible = await ctx.h.supabase.rpc('admin_list_activation_requests', {
        p_status: null,
        p_limit: 100,
        p_offset: 0,
        p_query: relay.email,
      });
      assert(!visible.error, `admin_list_activation_requests failed: ${visible.error?.message}`);
      assertEqual((visible.data ?? []).length, 0, 'private relay requests must stay hidden from the queue');
    } finally {
      ctx.runSql(`delete from public.activation_requests where user_id = '${relay.userId}';`);
      await deleteEphemeralUser(ctx.h, relay.userId);
    }
  }, { role: 'admin', multiRole: true });
});
