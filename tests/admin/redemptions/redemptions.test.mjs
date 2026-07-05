/**
 * Admin panel — Redemption desk (refund + status guards).
 *
 * The happy redeem→fulfil/cancel paths live in mobile-app/redemption. Here we
 * assert the admin-only refund of an ALREADY-FULFILLED redemption restores points,
 * and that the status guards reject invalid transitions.
 */
import { suite, test, assert, assertEqual, assertRejects } from '../../lib/framework.mjs';

suite('Admin / redemptions', () => {
  test('refunding a fulfilled redemption restores the member points', async (ctx) => {
    await ctx.setRole('member');
    const cost = 40;
    const rewardId = ctx.createTestReward({ name: 'E2E Admin Refund', cost });
    const balance0 = ctx.getAccountBalance(ctx.userId);
    const topUp = ctx.ensureBalanceAtLeast(ctx.userId, cost);
    let redemptionId = null;
    try {
      const beforeRedeem = ctx.getAccountBalance(ctx.userId);
      const redeem = await ctx.h.supabase.rpc('redeem_reward', { p_reward: rewardId });
      assert(!redeem.error, `redeem: ${redeem.error?.message}`);
      redemptionId = redeem.data.id;

      await ctx.setRole('admin');
      const fulfil = await ctx.h.supabase.rpc('admin_fulfill_redemption', { p_redemption_id: redemptionId });
      assert(!fulfil.error, `fulfil: ${fulfil.error?.message}`);

      const refund = await ctx.h.supabase.rpc('admin_refund_redemption', {
        p_redemption_id: redemptionId,
        p_reason: 'e2e refund',
      });
      assert(!refund.error, `admin_refund_redemption failed: ${refund.error?.message}`);
      assertEqual(refund.data?.status, 'refunded', 'redemption must become refunded');
      assertEqual(ctx.getAccountBalance(ctx.userId), beforeRedeem, 'refund must restore the spent points');
    } finally {
      if (redemptionId) {
        ctx.runSql(`delete from public.points_ledger where ref_id = '${redemptionId}'::uuid;`);
        ctx.runSql(`delete from public.redemptions where id = '${redemptionId}'::uuid;`);
      }
      ctx.reverseBalanceTopUp(ctx.userId, topUp);
      ctx.runSql(`update public.points_accounts set balance = ${balance0} where user_id = '${ctx.userId}';`);
      ctx.deleteTestReward(rewardId);
    }
  }, { role: 'member', multiRole: true });

  test('fulfilling a non-existent redemption is rejected (NOT_FOUND)', async (ctx) => {
    await ctx.setRole('admin');
    await assertRejects(
      () => ctx.h.supabase.rpc('admin_fulfill_redemption', { p_redemption_id: '00000000-0000-0000-0000-000000000000' }),
      'NOT_FOUND',
      'fulfilling a missing redemption must fail',
    );
  }, { role: 'admin' });
});
