/**
 * Mobile app — Points engine (the money path).
 *
 * The rewards engine is database-owned: inserting a `check_ins` row fires the
 * `on_check_in` trigger which credits +10 points, writes a points_ledger entry,
 * recomputes the streak/discipline score, and evaluates milestones. We drive it
 * with isolated ephemeral members so assertions are exact and reversible.
 *
 * Asserts: exact credit, ledger integrity, lifetime/tier, streak math, and the
 * structural double-credit guard.
 */
import { suite, test, assert, assertEqual, assertGreaterOrEqual, assertRejects } from '../../lib/framework.mjs';
import { CHECK_IN_POINTS } from '../../lib/harness.mjs';

suite('Points / earning', () => {
  test('one gym check-in credits exactly +10 with a matching ledger entry', async (ctx) => {
    const m = await ctx.createEphemeralMember({ fullName: 'Points One' });
    try {
      const checkInId = insertCheckIn(ctx, m.userId, 'gate_scan', 'now()');
      const acct = ctx.runSql(
        `select balance, lifetime_points, tier from public.points_accounts where user_id = '${m.userId}';`,
      )[0];
      assertEqual(acct?.balance, CHECK_IN_POINTS, 'balance must be exactly +10');
      assertEqual(acct?.lifetime_points, CHECK_IN_POINTS, 'lifetime must be +10');
      assertEqual(acct?.tier, 'bronze', 'new member is bronze tier');

      const ledger = ctx.runSql(
        `select delta, reason, balance_after from public.points_ledger
         where user_id = '${m.userId}' and ref_id = '${checkInId}'::uuid;`,
      );
      assertEqual(ledger.length, 1, 'exactly one ledger row for the check-in');
      assertEqual(ledger[0].delta, CHECK_IN_POINTS, 'ledger delta must be +10');
      assertEqual(ledger[0].reason, 'check_in', 'ledger reason must be check_in');
      assertEqual(ledger[0].balance_after, CHECK_IN_POINTS, 'ledger balance_after must reconcile');
    } finally {
      await ctx.deleteEphemeralUser(m.userId);
    }
  }, { role: 'admin' });

  test('two consecutive-day check-ins → balance 20 and current streak 2', async (ctx) => {
    const m = await ctx.createEphemeralMember({ fullName: 'Points Streak' });
    try {
      insertCheckIn(ctx, m.userId, 'gate_scan', `now() - interval '1 day'`);
      insertCheckIn(ctx, m.userId, 'gate_scan', 'now()');
      const acct = ctx.runSql(
        `select balance, lifetime_points from public.points_accounts where user_id = '${m.userId}';`,
      )[0];
      assertEqual(acct?.balance, 2 * CHECK_IN_POINTS, 'two check-ins → balance 20');
      assertEqual(acct?.lifetime_points, 2 * CHECK_IN_POINTS, 'two check-ins → lifetime 20');

      const streak = currentStreak(ctx, m.userId);
      assertGreaterOrEqual(streak, 2, 'two consecutive days should give a streak of 2');
    } finally {
      await ctx.deleteEphemeralUser(m.userId);
    }
  }, { role: 'admin' });

  test('double-credit is structurally prevented (unique ledger idempotency index)', async (ctx) => {
    const m = await ctx.createEphemeralMember({ fullName: 'Points Idemp' });
    try {
      const checkInId = insertCheckIn(ctx, m.userId, 'gate_scan', 'now()');
      // Attempting to insert a second ledger row for the same (user, reason, ref_id)
      // must violate idx_points_ledger_user_reason_ref — proving no double crediting.
      await assertRejects(
        () =>
          Promise.resolve(
            ctx.runSql(
              `insert into public.points_ledger (user_id, delta, reason, ref_id, balance_after)
               values ('${m.userId}', 10, 'check_in', '${checkInId}'::uuid, 20);`,
            ),
          ),
        'duplicate key',
        'a duplicate check-in ledger entry must be rejected by the unique index',
      );
    } finally {
      await ctx.deleteEphemeralUser(m.userId);
    }
  }, { role: 'admin' });
});

// --- helpers -------------------------------------------------------------
function insertCheckIn(ctx, userId, method, whenExpr) {
  return ctx.runSql(
    `insert into public.check_ins (user_id, method, source, checked_in_at)
     values ('${userId}', '${method}', 'supabase', ${whenExpr})
     returning id::text as id;`,
  )[0].id;
}

function currentStreak(ctx, userId) {
  const fromScores = ctx.runSql(
    `select (components->>'currentStreak')::int as s from public.discipline_scores
     where user_id = '${userId}' limit 1;`,
  )[0]?.s;
  if (fromScores != null) return fromScores;
  return (
    ctx.runSql(
      `select current_streak as s from public.member_streaks where user_id = '${userId}' limit 1;`,
    )[0]?.s ?? 0
  );
}
