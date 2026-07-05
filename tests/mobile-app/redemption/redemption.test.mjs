/**
 * Mobile app — Reward redemption (member side) + admin lifecycle.
 *
 * Real flow: a member spends points via `redeem_reward` → a 'pending' redemption
 * is created and points are deducted. Staff later fulfil or cancel it (cancel
 * restores the points). We also assert every guard rail: insufficient points,
 * out-of-stock, and tier-locked rewards.
 *
 * redeem_reward keys off auth.uid(), so these run as the shared signed-in user
 * flipped to 'member' / 'admin'. Each test creates its own disposable reward and
 * fully restores the user's balance afterward.
 */
import { suite, test, assert, assertEqual, assertRejects } from '../../lib/framework.mjs';

suite('Redemption / happy path', () => {
  test('member redeems a reward → pending redemption, points deducted, ledger written', async (ctx) => {
    await ctx.setRole('member');
    const cost = 25;
    const rewardId = ctx.createTestReward({ name: 'E2E Redeem OK', cost });
    const balance0 = ctx.getAccountBalance(ctx.userId);
    const topUp = ctx.ensureBalanceAtLeast(ctx.userId, cost);
    let redemptionId = null;
    try {
      const before = ctx.getAccountBalance(ctx.userId);
      const { data, error } = await ctx.h.supabase.rpc('redeem_reward', { p_reward: rewardId });
      assert(!error, `redeem_reward failed: ${error?.message}`);
      redemptionId = data?.id;
      assertEqual(data?.status, 'pending', 'a fresh redemption is pending');
      assertEqual(data?.cost_points, cost, 'redemption records the reward cost');

      const after = ctx.getAccountBalance(ctx.userId);
      assertEqual(after, before - cost, 'balance must drop by the reward cost');

      const ledger = ctx.runSql(
        `select delta, reason from public.points_ledger
         where user_id = '${ctx.userId}' and ref_id = '${redemptionId}'::uuid and reason = 'redeem';`,
      );
      assertEqual(ledger.length, 1, 'a redeem ledger entry must be written');
      assertEqual(ledger[0].delta, -cost, 'redeem ledger delta is negative cost');
    } finally {
      cleanupRedemption(ctx, redemptionId, rewardId, balance0, topUp);
    }
  }, { role: 'member' });

  test('admin fulfils a pending redemption → status fulfilled (+audit)', async (ctx) => {
    await ctx.setRole('member');
    const cost = 15;
    const rewardId = ctx.createTestReward({ name: 'E2E Fulfil', cost });
    const balance0 = ctx.getAccountBalance(ctx.userId);
    const topUp = ctx.ensureBalanceAtLeast(ctx.userId, cost);
    let redemptionId = null;
    try {
      const redeem = await ctx.h.supabase.rpc('redeem_reward', { p_reward: rewardId });
      assert(!redeem.error, `redeem: ${redeem.error?.message}`);
      redemptionId = redeem.data.id;

      await ctx.setRole('admin');
      const fulfil = await ctx.h.supabase.rpc('admin_fulfill_redemption', { p_redemption_id: redemptionId });
      assert(!fulfil.error, `admin_fulfill_redemption: ${fulfil.error?.message}`);
      assertEqual(fulfil.data?.status, 'fulfilled', 'redemption must become fulfilled');

      const audit = ctx.runSql(
        `select count(*)::int as n from public.admin_audit_log
         where action = 'fulfill_redemption' and target_id = '${redemptionId}';`,
      )[0];
      assert(audit.n >= 1, 'fulfilment should write an admin audit entry');
    } finally {
      cleanupRedemption(ctx, redemptionId, rewardId, balance0, topUp);
    }
  }, { role: 'member', multiRole: true });

  test('admin cancels a pending redemption → points are refunded', async (ctx) => {
    await ctx.setRole('member');
    const cost = 30;
    const rewardId = ctx.createTestReward({ name: 'E2E Cancel', cost });
    const balance0 = ctx.getAccountBalance(ctx.userId);
    const topUp = ctx.ensureBalanceAtLeast(ctx.userId, cost);
    let redemptionId = null;
    try {
      const beforeRedeem = ctx.getAccountBalance(ctx.userId);
      const redeem = await ctx.h.supabase.rpc('redeem_reward', { p_reward: rewardId });
      assert(!redeem.error, `redeem: ${redeem.error?.message}`);
      redemptionId = redeem.data.id;
      assertEqual(ctx.getAccountBalance(ctx.userId), beforeRedeem - cost, 'points deducted on redeem');

      await ctx.setRole('admin');
      const cancel = await ctx.h.supabase.rpc('admin_cancel_redemption', {
        p_redemption_id: redemptionId,
        p_reason: 'e2e cancel',
      });
      assert(!cancel.error, `admin_cancel_redemption: ${cancel.error?.message}`);
      assertEqual(cancel.data?.status, 'cancelled', 'redemption must become cancelled');
      assertEqual(ctx.getAccountBalance(ctx.userId), beforeRedeem, 'cancel must restore the points');
    } finally {
      cleanupRedemption(ctx, redemptionId, rewardId, balance0, topUp);
    }
  }, { role: 'member', multiRole: true });
});

suite('Redemption / guard rails', () => {
  test('redeeming with insufficient points is rejected', async (ctx) => {
    await ctx.setRole('member');
    const rewardId = ctx.createTestReward({ name: 'E2E Too Pricey', cost: 999999 });
    try {
      await assertRejects(
        () => ctx.h.supabase.rpc('redeem_reward', { p_reward: rewardId }),
        'INSUFFICIENT_POINTS',
        'an unaffordable reward must be rejected',
      );
    } finally {
      ctx.deleteTestReward(rewardId);
    }
  }, { role: 'member' });

  test('redeeming an out-of-stock reward is rejected', async (ctx) => {
    await ctx.setRole('member');
    const cost = 5;
    const rewardId = ctx.createTestReward({ name: 'E2E No Stock', cost, inventory: 0 });
    const balance0 = ctx.getAccountBalance(ctx.userId);
    const topUp = ctx.ensureBalanceAtLeast(ctx.userId, cost);
    try {
      await assertRejects(
        () => ctx.h.supabase.rpc('redeem_reward', { p_reward: rewardId }),
        'OUT_OF_STOCK',
        'a reward with zero inventory must be rejected',
      );
    } finally {
      ctx.reverseBalanceTopUp(ctx.userId, topUp);
      ctx.runSql(`update public.points_accounts set balance = ${balance0} where user_id = '${ctx.userId}';`);
      ctx.deleteTestReward(rewardId);
    }
  }, { role: 'member' });

  test('a tier-locked reward is rejected for a below-tier member', async (ctx) => {
    await ctx.setRole('member');
    const cost = 5;
    // requiresTier gold; the test user is not gold unless they have 4000 lifetime pts.
    const tier = ctx.runSql(
      `select tier from public.points_accounts where user_id = '${ctx.userId}' limit 1;`,
    )[0]?.tier;
    if (tier === 'gold') return ctx.skip('test user already at gold tier; tier-lock not assertable');
    const rewardId = ctx.createTestReward({ name: 'E2E Gold Only', cost, tier: 'gold' });
    const balance0 = ctx.getAccountBalance(ctx.userId);
    const topUp = ctx.ensureBalanceAtLeast(ctx.userId, cost);
    try {
      await assertRejects(
        () => ctx.h.supabase.rpc('redeem_reward', { p_reward: rewardId }),
        'REWARD_LOCKED',
        'a gold-locked reward must be rejected for a non-gold member',
      );
    } finally {
      ctx.reverseBalanceTopUp(ctx.userId, topUp);
      ctx.runSql(`update public.points_accounts set balance = ${balance0} where user_id = '${ctx.userId}';`);
      ctx.deleteTestReward(rewardId);
    }
  }, { role: 'member' });
});

// --- helpers -------------------------------------------------------------
function cleanupRedemption(ctx, redemptionId, rewardId, balance0, topUp) {
  if (redemptionId) {
    ctx.runSql(`delete from public.points_ledger where ref_id = '${redemptionId}'::uuid;`);
    ctx.runSql(`delete from public.redemptions where id = '${redemptionId}'::uuid;`);
  }
  ctx.reverseBalanceTopUp(ctx.userId, topUp);
  // Hard-restore to the exact pre-test balance (covers the redeem deduction).
  ctx.runSql(`update public.points_accounts set balance = ${balance0} where user_id = '${ctx.userId}';`);
  ctx.deleteTestReward(rewardId);
}
