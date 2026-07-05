/**
 * Mobile app — Profile, notification preferences, support, account deletion.
 *
 * Covers the self-service settings paths a real user touches: toggling
 * notification categories, filing a support message, and requesting account
 * deletion (a GDPR/App-Store requirement).
 */
import { suite, test, assert, assertEqual } from '../../lib/framework.mjs';

suite('Profile / notification preferences', () => {
  test('notification preferences round-trip (read → update → restore)', async (ctx) => {
    await ctx.setRole('member');
    const before = await ctx.h.supabase.rpc('get_notification_preferences');
    assert(!before.error, `get_notification_preferences failed: ${before.error?.message}`);
    const original = before.data?.announcements ?? before.data?.[0]?.announcements;

    const flipped = !original;
    const upd = await ctx.h.supabase.rpc('update_notification_preferences', { p_announcements: flipped });
    assert(!upd.error, `update_notification_preferences failed: ${upd.error?.message}`);

    const after = await ctx.h.supabase.rpc('get_notification_preferences');
    const got = after.data?.announcements ?? after.data?.[0]?.announcements;
    assertEqual(got, flipped, 'preference update must persist');

    // restore
    await ctx.h.supabase.rpc('update_notification_preferences', { p_announcements: original });
  }, { role: 'member' });
});

suite('Profile / support', () => {
  test('a member can file a support message', async (ctx) => {
    await ctx.setRole('member');
    const res = await ctx.h.supabase.rpc('submit_support_message', {
      p_category: 'general',
      p_subject: 'E2E support probe',
      p_message: 'Automated regression check — please ignore.',
    });
    assert(!res.error, `submit_support_message failed: ${res.error?.message}`);
    const id = res.data?.id ?? res.data?.[0]?.id;
    try {
      const row = ctx.runSql(
        `select status, user_id::text as user_id from public.support_messages where id = '${id}'::uuid;`,
      )[0];
      assert(row, 'support message must be persisted');
      assertEqual(row.user_id, ctx.userId, 'support message must be owned by the member');
    } finally {
      ctx.runSql(`delete from public.support_messages where id = '${id}'::uuid;`);
    }
  }, { role: 'member' });
});

suite('Profile / account deletion (App Store requirement)', () => {
  test('a member can request account deletion → a pending request is recorded', async (ctx) => {
    const m = await ctx.createEphemeralMember({ fullName: 'Delete Me' });
    try {
      const { token } = await ctx.signInRaw(m.email, m.password);
      const res = await ctx.rpcAs(token, 'request_account_deletion', {});
      assert(res.ok, `request_account_deletion failed: ${JSON.stringify(res.error)}`);
      const row = ctx.runSql(
        `select status from public.account_deletion_requests where user_id = '${m.userId}' limit 1;`,
      )[0];
      assert(row, 'a deletion request row must be recorded');
      assert(['pending', 'requested', 'open'].includes(row.status), `unexpected status ${row.status}`);
      return { status: row.status };
    } finally {
      ctx.runSql(`delete from public.account_deletion_requests where user_id = '${m.userId}';`);
      await ctx.deleteEphemeralUser(m.userId);
    }
  });
});
