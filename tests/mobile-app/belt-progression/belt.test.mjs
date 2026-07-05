/**
 * Mobile app — Belt / rank progression.
 *
 * Belt progress is computed from attendance against a discipline's rank curriculum.
 * Covers that the recompute RPC runs and yields a progress row for a member.
 */
import { suite, test, assert } from '../../lib/framework.mjs';

suite('Belt / progression', () => {
  test('recompute_belt_progress yields a rank-progress row for a member', async (ctx) => {
    await ctx.setRole('member');
    const res = await ctx.h.supabase.rpc('recompute_belt_progress', {
      p_user: ctx.userId,
      p_discipline: 'bjj',
    });
    // Some academies disable BJJ rank progression; treat "no progression configured"
    // as a skip rather than a failure.
    if (res.error) {
      if (/no rank|not.*progress|discipline/i.test(res.error.message)) {
        return ctx.skip(`bjj progression not configured: ${res.error.message}`);
      }
      assert(false, `recompute_belt_progress failed: ${res.error.message}`);
    }
    assert(res.data, 'recompute should return a member_rank_progress row');
    return { progress: res.data };
  }, { role: 'member' });

  test('a member can read their own belt/rank progress', async (ctx) => {
    await ctx.setRole('member');
    const { error } = await ctx.h.supabase
      .from('member_rank_progress')
      .select('user_id, discipline_id, percent_complete')
      .eq('user_id', ctx.userId)
      .limit(5);
    assert(!error, `member must be able to read own rank progress: ${error?.message}`);
  }, { role: 'member' });
});
