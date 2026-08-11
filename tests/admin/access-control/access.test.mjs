/**
 * Admin panel — Access control (the gate that protects every privileged action).
 *
 * Every admin RPC is guarded by require_admin()/is_admin(). These tests prove a
 * non-admin (member) is rejected and an admin is admitted. The admin panel UI is a
 * thin client over exactly these RPCs, so this is the security boundary that keeps
 * 1000 members out of staff tooling.
 */
import { suite, test, assert, assertRejects } from '../../lib/framework.mjs';

const PRIVILEGED = [
  ['admin_search_users', { p_query: '', p_limit: 1, p_offset: 0 }],
  ['admin_system_health', {}],
  ['admin_reports_summary', {}],
];

suite('Admin / access control', () => {
  test('a member is rejected from every privileged RPC', async (ctx) => {
    await ctx.setRole('member');
    for (const [fn, args] of PRIVILEGED) {
      await assertRejects(
        () => ctx.h.supabase.rpc(fn, args),
        null,
        `member must NOT be able to call ${fn}`,
      );
    }
    return { guarded: PRIVILEGED.map((p) => p[0]) };
  }, { role: 'member' });

  test('an admin is admitted to the same privileged RPCs', async (ctx) => {
    await ctx.setRole('admin');
    for (const [fn, args] of PRIVILEGED) {
      const res = await ctx.h.supabase.rpc(fn, args);
      assert(!res.error, `admin must be able to call ${fn}: ${res.error?.message}`);
    }
  }, { role: 'admin' });
});
