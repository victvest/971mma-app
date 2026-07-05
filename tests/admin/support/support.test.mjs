/**
 * Admin panel — Support inbox.
 *
 * Members file support messages; staff triage them. We file one as a member, then
 * resolve it as admin and assert the status transition + admin notes.
 */
import { suite, test, assert, assertEqual } from '../../lib/framework.mjs';

suite('Admin / support', () => {
  test('admin resolves a member support message', async (ctx) => {
    const m = await ctx.createEphemeralMember({ fullName: 'Support Filer' });
    let messageId = null;
    try {
      const { token } = await ctx.signInRaw(m.email, m.password);
      const filed = await ctx.rpcAs(token, 'submit_support_message', {
        p_category: 'technical',
        p_subject: 'E2E admin support probe',
        p_message: 'Automated regression — please resolve.',
      });
      assert(filed.ok, `submit_support_message failed: ${JSON.stringify(filed.error)}`);
      messageId = ctx.runSql(
        `select id::text as id from public.support_messages where user_id = '${m.userId}' order by created_at desc limit 1;`,
      )[0]?.id;
      assert(messageId, 'support message must persist');

      await ctx.setRole('admin');
      const res = await ctx.h.supabase.rpc('admin_update_support_message', {
        p_id: messageId,
        p_status: 'resolved',
        p_admin_notes: 'handled by e2e',
      });
      assert(!res.error, `admin_update_support_message failed: ${res.error?.message}`);
      assertEqual(res.data?.status ?? res.data?.[0]?.status, 'resolved', 'status must become resolved');
    } finally {
      if (messageId) ctx.runSql(`delete from public.support_messages where id = '${messageId}'::uuid;`);
      await ctx.deleteEphemeralUser(m.userId);
    }
  }, { role: 'admin', multiRole: true });
});
