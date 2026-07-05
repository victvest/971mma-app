/**
 * Mobile app — Member pass QR + coach scanning it (class check-in).
 *
 * Real flow:
 *   - A member opens their pass: the app calls `qr-issue` to mint a short-lived
 *     signed v2 token encoding their member id.
 *   - A coach scans that pass. The scanner parses the member id and the coach's
 *     `mb-checkin` records a `qr_scan` class check-in. The token is single-use
 *     (replay protected) and only coaches/admins may consume it.
 */
import { suite, test, assert, assertEqual } from '../../lib/framework.mjs';
import { simulateCoachScannerParse } from '../../lib/harness.mjs';

suite('Member pass / issue', () => {
  test('member mints a signed v2 pass that expires within ~90s', async (ctx) => {
    await ctx.setRole('member');
    const pass = await ctx.h.issueMemberQr();
    const parts = pass.token.split(':');
    assertEqual(parts[0], '971mma');
    assertEqual(parts[1], 'v2');
    assert(parts[2] === 'supabase' || parts[2] === 'mindbody', `unexpected pass kind ${parts[2]}`);
    assertEqual(parts[3], ctx.userId, 'pass must encode the signed-in member id');

    const rows = ctx.runSql(
      `select count(*)::int as n from public.qr_tokens
       where user_id = '${ctx.userId}' and expires_at > now();`,
    );
    assert(rows[0].n >= 1, 'an active qr_tokens row should exist after issue');

    const exp = Number(parts[4]) * 1000;
    assert(exp - Date.now() <= 120_000, 'pass should be short-lived (<=120s)');
  }, { role: 'member' });

  test('coach scanner parses the member id out of a v2 pass', async (ctx) => {
    await ctx.setRole('member');
    const pass = await ctx.h.issueMemberQr();
    const parsed = simulateCoachScannerParse(pass.token);
    assertEqual(parsed?.memberId, ctx.userId, 'scanner must recover the member id');
  }, { role: 'member' });
});

suite('Member pass / coach class scan (mb-checkin)', () => {
  test('coach consumes a member pass once; replay is blocked; members cannot consume', async (ctx) => {
    await ctx.setRole('member');
    ctx.h.clearTodayCheckIns();
    const pass = await ctx.h.issueMemberQr();
    const token = pass.token;

    await ctx.setRole('coach');
    const first = await ctx.invokeEdge('mb-checkin', { token });

    // mb-checkin writes back to Mindbody; if the test member is not linked or the
    // MB sandbox blocks arrivals, the token path is unavailable — record as skip.
    if (!first.ok && ['NOT_LINKED', 'UPSTREAM_ERROR'].includes(first.body?.error?.code)) {
      return ctx.skip(`mb-checkin unavailable for test member: ${first.body?.error?.code}`);
    }
    assert(first.ok && first.body?.success, `mb-checkin failed: ${JSON.stringify(first.body)}`);

    const row = ctx.h.getLatestCheckIn();
    assertEqual(row?.method, 'qr_scan', 'coach scan must record qr_scan method');

    const replay = await ctx.invokeEdge('mb-checkin', { token });
    assertEqual(replay.body?.error?.code, 'TOKEN_REPLAYED', 'single-use token must block replay');

    await ctx.setRole('member');
    const asMember = await ctx.invokeEdge('mb-checkin', { token });
    assertEqual(asMember.body?.error?.code, 'FORBIDDEN', 'a member must not consume a scan token');
  }, { role: 'member', multiRole: true });
});
