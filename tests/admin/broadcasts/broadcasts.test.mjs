/**
 * Admin panel — Broadcasts / announcements.
 *
 * Staff send a broadcast; it persists an announcement and fans out notifications
 * to the audience (which the app surfaces + push delivers). We assert persistence
 * and clean up both the announcement and any fanned-out notifications.
 */
import { suite, test, assert } from '../../lib/framework.mjs';

suite('Admin / broadcasts', () => {
  test('admin_send_broadcast persists an announcement', async (ctx) => {
    await ctx.setRole('admin');
    const title = `E2E Broadcast ${Date.now()}`;
    const body = 'Automated regression broadcast — ignore.';
    const res = await ctx.h.supabase.rpc('admin_send_broadcast', {
      p_title: title,
      p_body: body,
      p_audience: 'members',
      p_channel: 'broadcast',
    });
    assert(!res.error, `admin_send_broadcast failed: ${res.error?.message}`);
    const safeTitle = title.replace(/'/g, "''");
    try {
      const row = ctx.runSql(
        `select id::text as id from public.announcements where title = '${safeTitle}' limit 1;`,
      )[0];
      assert(row, 'broadcast must persist an announcement row');
    } finally {
      // notifications has no `title` column (cols: type, payload jsonb); the fanout
      // stores the broadcast text inside payload. Clean up by payload match + recency.
      ctx.runSql(
        `delete from public.notifications
         where created_at > now() - interval '5 minutes' and payload::text like '%${safeTitle}%';`,
      );
      ctx.runSql(`delete from public.announcements where title = '${safeTitle}';`);
    }
  }, { role: 'admin' });
});
