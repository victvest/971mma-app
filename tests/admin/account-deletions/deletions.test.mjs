/**
 * Admin panel — Account deletion queue.
 *
 * Members request deletion (App Store requirement); staff process the queue. We
 * assert an admin can advance a request's status WITHOUT actually destroying the
 * account (we use the non-destructive 'cancelled' transition) and that the
 * account survives.
 */
import { suite, test, assert, assertEqual } from '../../lib/framework.mjs';

suite('Admin / account deletions', () => {
  test('admin advances a deletion request status without destroying the account', async (ctx) => {
    const m = await ctx.createEphemeralMember({ fullName: 'Deletion Queue' });
    try {
      const { token } = await ctx.signInRaw(m.email, m.password);
      const req = await ctx.rpcAs(token, 'request_account_deletion', {});
      assert(req.ok, `request_account_deletion failed: ${JSON.stringify(req.error)}`);
      const reqRow = ctx.runSql(
        `select id::text as id from public.account_deletion_requests where user_id = '${m.userId}' limit 1;`,
      )[0];
      assert(reqRow, 'a deletion request must exist');

      await ctx.setRole('admin');
      const upd = await ctx.h.supabase.rpc('admin_update_account_deletion_request', {
        p_id: reqRow.id,
        p_status: 'cancelled',
        p_notes: 'e2e non-destructive transition',
      });
      assert(!upd.error, `admin_update_account_deletion_request failed: ${upd.error?.message}`);
      assertEqual(upd.data?.status, 'cancelled', 'status must advance to cancelled');

      const stillThere = ctx.runSql(`select id from public.profiles where id = '${m.userId}';`)[0];
      assert(stillThere, 'a cancelled request must NOT delete the account');
    } finally {
      ctx.runSql(`delete from public.account_deletion_requests where user_id = '${m.userId}';`);
      await ctx.deleteEphemeralUser(m.userId);
    }
  }, { role: 'admin', multiRole: true });
});
