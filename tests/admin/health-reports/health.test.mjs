/**
 * Admin panel — System health & reports dashboards.
 *
 * The admin home surfaces system health and a reports summary. We assert both
 * RPCs answer with structured payloads for an admin (and are denied to members —
 * covered in access-control).
 */
import { suite, test, assert } from '../../lib/framework.mjs';

suite('Admin / health & reports', () => {
  test('admin_system_health returns a structured payload', async (ctx) => {
    await ctx.setRole('admin');
    const res = await ctx.h.supabase.rpc('admin_system_health');
    assert(!res.error, `admin_system_health failed: ${res.error?.message}`);
    assert(res.data && typeof res.data === 'object', 'health must be a structured object');
    return { keys: Object.keys(res.data).slice(0, 12) };
  }, { role: 'admin' });

  test('admin_reports_summary returns a structured payload', async (ctx) => {
    await ctx.setRole('admin');
    const res = await ctx.h.supabase.rpc('admin_reports_summary');
    assert(!res.error, `admin_reports_summary failed: ${res.error?.message}`);
    assert(res.data && typeof res.data === 'object', 'reports summary must be a structured object');
    return { keys: Object.keys(res.data).slice(0, 12) };
  }, { role: 'admin' });
});
