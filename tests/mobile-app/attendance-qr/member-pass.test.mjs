/**
 * Mobile app — Member pass QR + coach scanning it (class check-in).
 *
 * Real flow:
 *   - Member opens Check-in → `qr-issue` mints a short-lived signed v2 token.
 *   - Facility entry: member shows that QR to the SALTO/Gantner scanner (not us).
 *   - Class attendance: coach opens Run Class → Scan QR → `record_roll_call_mark`
 *     (method `qr_scan` on the roll-call mark). That path does not burn the gate pass.
 *
 * Legacy `mb-checkin` with a bare token (facility via coach phone) is retired —
 * it raced SALTO by writing `qr_scan` facility rows and consuming the same jti.
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

suite('Member pass / legacy mb-checkin facility path retired', () => {
  test('bare token check-in is rejected (facility is SALTO-only)', async (ctx) => {
    await ctx.setRole('member');
    const pass = await ctx.h.issueMemberQr();
    const token = pass.token;

    await ctx.setRole('coach');
    const first = await ctx.invokeEdge('mb-checkin', { token });

    assertEqual(
      first.body?.error?.code,
      'BAD_REQUEST',
      `legacy facility mb-checkin must be rejected, got: ${JSON.stringify(first.body)}`,
    );

    await ctx.setRole('member');
    const asMember = await ctx.invokeEdge('mb-checkin', { token });
    assert(
      asMember.body?.error?.code === 'FORBIDDEN' || asMember.body?.error?.code === 'BAD_REQUEST',
      'a member must not consume a scan token',
    );
  }, { role: 'member', multiRole: true });
});
