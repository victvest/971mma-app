/**
 * Admin panel — Content management (rewards catalog, milestones, etc.).
 *
 * Staff toggle catalog content via admin_update_content_entry. We flip a test
 * reward's `active` flag and assert the change, then clean up.
 */
import { suite, test, assert, assertEqual } from '../../lib/framework.mjs';

suite('Admin / content', () => {
  test('admin_update_content_entry toggles a reward active flag', async (ctx) => {
    await ctx.setRole('admin');
    const rewardId = ctx.createTestReward({ name: 'E2E Content Toggle', cost: 10, active: true });
    try {
      const res = await ctx.h.supabase.rpc('admin_update_content_entry', {
        p_table: 'rewards_catalog',
        p_id: rewardId,
        p_payload: { active: false },
      });
      assert(!res.error, `admin_update_content_entry failed: ${res.error?.message}`);
      assertEqual(
        ctx.runSql(`select active from public.rewards_catalog where id = '${rewardId}'::uuid;`)[0].active,
        false,
        'reward active flag must be updated',
      );
    } finally {
      ctx.deleteTestReward(rewardId);
    }
  }, { role: 'admin' });
});
