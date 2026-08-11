/**
 * Admin panel — User management.
 *
 * Covers admin user search and role assignment (admin_set_user_role), the action
 * that promotes a member to coach or demotes them. Acts on an ephemeral user
 * so no real member is touched.
 */
import { suite, test, assert, assertEqual } from '../../lib/framework.mjs';

suite('Admin / users', () => {
  test('admin_search_users finds an account by name', async (ctx) => {
    const m = await ctx.createEphemeralMember({ fullName: `Searchable ${Date.now()}` });
    try {
      const name = ctx.runSql(`select full_name from public.profiles where id = '${m.userId}';`)[0].full_name;
      await ctx.setRole('admin');
      const res = await ctx.h.supabase.rpc('admin_search_users', {
        p_query: name,
        p_limit: 10,
        p_offset: 0,
      });
      assert(!res.error, `admin_search_users failed: ${res.error?.message}`);
      const hit = (res.data ?? []).some((r) => r.id === m.userId || r.user_id === m.userId);
      assert(hit, 'search should surface the created account');
    } finally {
      await ctx.deleteEphemeralUser(m.userId);
    }
  }, { role: 'admin', multiRole: true });

  test('admin_set_user_role promotes a member to coach and back', async (ctx) => {
    const m = await ctx.createEphemeralMember({ fullName: 'Role Target' });
    try {
      await ctx.setRole('admin');
      const up = await ctx.h.supabase.rpc('admin_set_user_role', { p_user_id: m.userId, p_role: 'coach' });
      assert(!up.error, `set role coach failed: ${up.error?.message}`);
      assertEqual(
        ctx.runSql(`select role from public.profiles where id = '${m.userId}';`)[0].role,
        'coach',
        'role must become coach',
      );

      const down = await ctx.h.supabase.rpc('admin_set_user_role', { p_user_id: m.userId, p_role: 'member' });
      assert(!down.error, `set role member failed: ${down.error?.message}`);
      assertEqual(
        ctx.runSql(`select role from public.profiles where id = '${m.userId}';`)[0].role,
        'member',
        'role must revert to member',
      );
    } finally {
      await ctx.deleteEphemeralUser(m.userId);
    }
  }, { role: 'admin' });
});
