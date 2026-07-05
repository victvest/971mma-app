/**
 * Mobile app — Gate entrance QR (the "gate" role tablet) + member self check-in.
 *
 * Real flow:
 *   1. The gate tablet (role: gate) displays a short-lived rotating signed QR.
 *   2. A member scans it; the app calls `entry-checkin` with the gate token +
 *      device GPS. The backend verifies the signature, geofence, and single-use,
 *      records a `gate_scan` check-in, and awards +10 points.
 *
 * Covers: happy path (+points, audit), geofence rejection, same-day duplicate,
 * forged signature, and missing-field validation.
 */
import { suite, test, assert, assertEqual, assertGreaterOrEqual } from '../../lib/framework.mjs';
import {
  ACADEMY_LAT,
  ACADEMY_LNG,
  FAR_LAT,
  FAR_LNG,
  GATE_LOCATION_ID,
  CHECK_IN_POINTS,
  simulateEntranceScannerReject,
} from '../../lib/harness.mjs';
import { randomUUID } from 'crypto';

suite('Gate entry / display', () => {
  test('gate role issues a signed v2 entrance token', async (ctx) => {
    await ctx.setRole('gate');
    const gate = await ctx.h.issueGateQr('e2e-gate-display');
    const parts = gate.token.split(':');
    assertEqual(parts[0], '971mma', 'token brand prefix');
    assertEqual(parts[1], 'v2', 'token version');
    assertEqual(parts[2], 'gate', 'token kind must be gate');
    assert(parts.length === 7, `gate token must have 7 segments, got ${parts.length}`);
    // exp in the future
    const exp = Number(parts[4]);
    assertGreaterOrEqual(exp, Math.floor(Date.now() / 1000), 'gate token exp must be in the future');
    return { locationId: parts[3] };
  }, { role: 'gate', multiRole: true });

  test('a member pass presented at the gate scanner is rejected client-side', async (ctx) => {
    await ctx.setRole('member');
    const pass = await ctx.h.issueMemberQr();
    // simulateEntranceScannerReject mirrors the device scanner's client-side guard.
    assertEqual(
      simulateEntranceScannerReject(pass.token),
      'member_pass_at_gate',
      'gate scanner must reject a member pass',
    );
  }, { role: 'member', multiRole: true });
});

suite('Gate entry / member self check-in', () => {
  test('member scans gate QR at the academy → gate_scan check-in + points', async (ctx) => {
    await ctx.setRole('member');
    ctx.h.clearTodayCheckIns();

    await ctx.setRole('gate');
    const gate = await ctx.h.issueGateQr('e2e-entry-success');
    const gateJti = gate.token.split(':')[5];

    await ctx.setRole('member');
    const before = ctx.h.getPointsBalance();
    const res = await ctx.invokeEdge('entry-checkin', {
      gateToken: gate.token,
      latitude: ACADEMY_LAT,
      longitude: ACADEMY_LNG,
    });
    assert(res.ok && res.body?.success, `entry-checkin failed: ${JSON.stringify(res.body)}`);

    const row = ctx.h.getLatestCheckIn();
    assertEqual(row?.method, 'gate_scan', 'check-in method must be gate_scan');
    assertEqual(row?.gate_jti, gateJti, 'gate_jti audit must match the scanned token');

    const after = ctx.h.getPointsBalance();
    assertGreaterOrEqual(after, before + CHECK_IN_POINTS, `expected +${CHECK_IN_POINTS} points`);
    return { pointsDelta: after - before, checkInId: res.body.checkInId };
  }, { role: 'member', multiRole: true });

  test('scanning from outside the geofence is rejected with distance', async (ctx) => {
    await ctx.setRole('member');
    ctx.h.clearTodayCheckIns();
    await ctx.setRole('gate');
    const gate = await ctx.h.issueGateQr('e2e-geofence');
    await ctx.setRole('member');
    const res = await ctx.invokeEdge('entry-checkin', {
      gateToken: gate.token,
      latitude: FAR_LAT,
      longitude: FAR_LNG,
    });
    assertEqual(res.body?.error?.code, 'OUTSIDE_GEOFENCE', 'far GPS must be rejected');
    assert(typeof res.body?.error?.distanceM === 'number', 'rejection should report distanceM');
  }, { role: 'member', multiRole: true });

  test('a second scan the same day is rejected as ALREADY_CHECKED_IN', async (ctx) => {
    await ctx.setRole('member');
    ctx.h.clearTodayCheckIns();
    await ctx.setRole('gate');
    const gate = await ctx.h.issueGateQr('e2e-duplicate');
    await ctx.setRole('member');
    const first = await ctx.invokeEdge('entry-checkin', {
      gateToken: gate.token,
      latitude: ACADEMY_LAT,
      longitude: ACADEMY_LNG,
    });
    assert(first.ok, `first check-in should succeed: ${JSON.stringify(first.body)}`);
    const dup = await ctx.invokeEdge('entry-checkin', {
      gateToken: gate.token,
      latitude: ACADEMY_LAT,
      longitude: ACADEMY_LNG,
    });
    assertEqual(dup.body?.error?.code, 'ALREADY_CHECKED_IN', 'same-day duplicate must be blocked');
  }, { role: 'member', multiRole: true });

  test('a forged gate signature is rejected as TOKEN_INVALID', async (ctx) => {
    await ctx.setRole('member');
    const exp = Math.floor(Date.now() / 1000) + 120;
    const forged = `971mma:v2:gate:${GATE_LOCATION_ID}:${exp}:${randomUUID()}:invalid-signature`;
    const res = await ctx.invokeEdge('entry-checkin', {
      gateToken: forged,
      latitude: ACADEMY_LAT,
      longitude: ACADEMY_LNG,
    });
    assertEqual(res.body?.error?.code, 'TOKEN_INVALID', 'forged signature must be rejected');
  }, { role: 'member' });

  test('missing GPS is rejected as BAD_REQUEST', async (ctx) => {
    await ctx.setRole('gate');
    const gate = await ctx.h.issueGateQr('e2e-badrequest');
    await ctx.setRole('member');
    const res = await ctx.invokeEdge('entry-checkin', { gateToken: gate.token });
    assertEqual(res.body?.error?.code, 'BAD_REQUEST', 'missing geo must be 400 BAD_REQUEST');
  }, { role: 'member', multiRole: true });
});
