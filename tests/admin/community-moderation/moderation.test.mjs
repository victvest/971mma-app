/**
 * Admin panel — Community moderation.
 *
 * Staff review reported/community content. We assert the moderation listing is
 * admin-callable and returns a well-formed result set (it may be empty in a clean
 * environment; the contract + authorization is what matters).
 */
import { suite, test, assert } from '../../lib/framework.mjs';

suite('Admin / community moderation', () => {
  test('admin_list_community_moderation is admin-callable and returns rows', async (ctx) => {
    await ctx.setRole('admin');
    const res = await ctx.h.supabase.rpc('admin_list_community_moderation', { p_limit: 25, p_offset: 0 });
    assert(!res.error, `admin_list_community_moderation failed: ${res.error?.message}`);
    assert(Array.isArray(res.data), 'moderation listing must be an array');
    return { rows: res.data.length };
  }, { role: 'admin' });

  test('admin_list_community_channels is admin-callable', async (ctx) => {
    await ctx.setRole('admin');
    const res = await ctx.h.supabase.rpc('admin_list_community_channels');
    assert(!res.error, `admin_list_community_channels failed: ${res.error?.message}`);
    return { ok: true };
  }, { role: 'admin' });
});
