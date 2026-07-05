/**
 * Mobile app — Referral program.
 *
 * A member shares a referral code; a friend who signs up and applies it is linked
 * to the referrer. Points are awarded later by the engine once the referred member
 * qualifies (check-ins). Covers code issuance, submission, application (real
 * second actor via rpcAs), and rejection of bad codes.
 */
import { suite, test, assert, assertEqual, assertRejects } from '../../lib/framework.mjs';

suite('Referrals / code', () => {
  test('a member has a stable referral code', async (ctx) => {
    await ctx.setRole('member');
    const a = await ctx.h.supabase.rpc('get_my_referral_code');
    assert(!a.error, `get_my_referral_code failed: ${a.error?.message}`);
    assert(typeof a.data === 'string' && a.data.length >= 4, `expected a code, got ${a.data}`);
    const b = await ctx.h.supabase.rpc('get_my_referral_code');
    assertEqual(b.data, a.data, 'the referral code must be stable across calls');
    return { code: a.data };
  }, { role: 'member' });

  test('a member can read their referral status payload', async (ctx) => {
    // NOTE: the app's "refer a friend" surface uses get_my_referral_code +
    // apply_referral_code (verified below). `submit_referral` exists but is granted
    // to service_role only and is NOT called by the app, so it is intentionally not
    // exercised here (see TEST-NOTES).
    await ctx.setRole('member');
    const res = await ctx.h.supabase.rpc('get_my_referral_status');
    assert(!res.error, `get_my_referral_status failed: ${res.error?.message}`);
    assert(res.data && typeof res.data === 'object', 'referral status must be a structured payload');
  }, { role: 'member' });
});

suite('Referrals / application', () => {
  test('a new member applying a valid code is linked to the referrer', async (ctx) => {
    await ctx.setRole('member');
    const code = (await ctx.h.supabase.rpc('get_my_referral_code')).data;
    assert(code, 'referrer needs a code');

    // Referral codes can only be applied by a member who is NOT yet active
    // (apply_referral_code rejects already-active accounts as ALREADY_ACTIVE).
    const friend = await ctx.createEphemeralMember({ fullName: 'Referred Friend', accountStatus: 'registered' });
    try {
      const { token, userId } = await ctx.signInRaw(friend.email, friend.password);
      const apply = await ctx.rpcAs(token, 'apply_referral_code', { p_code: code });
      assert(apply.ok, `apply_referral_code failed: ${JSON.stringify(apply.error)}`);

      const row = ctx.runSql(
        `select referrer_user_id::text as ref, referred_user_id::text as friend, status
         from public.referrals where referred_user_id = '${userId}' limit 1;`,
      )[0];
      assert(row, 'a referral row must link the applying member');
      assertEqual(row.ref, ctx.userId, 'referral must point at the referrer');
    } finally {
      ctx.runSql(`delete from public.referrals where referred_user_id = '${friend.userId}';`);
      await ctx.deleteEphemeralUser(friend.userId);
    }
  }, { role: 'member', multiRole: true });

  test('applying a non-existent code is rejected', async (ctx) => {
    const friend = await ctx.createEphemeralMember({ fullName: 'Bad Code Friend', accountStatus: 'registered' });
    try {
      const { token } = await ctx.signInRaw(friend.email, friend.password);
      const apply = await ctx.rpcAs(token, 'apply_referral_code', { p_code: 'ZZZ-NOPE-0000' });
      assert(!apply.ok, 'a bogus referral code must not succeed');
    } finally {
      await ctx.deleteEphemeralUser(friend.userId);
    }
  });
});
