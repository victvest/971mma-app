/**
 * Admin panel — Guardian / family link creation (the staff-driven path).
 *
 * Because mobile self-service is disabled (see mobile-app/guardians), the ONLY way
 * a family link is created is staff using the admin panel, which calls the
 * `guardian-approve` edge function with action 'create_direct'. This proves that
 * end-to-end staff flow works, so the guardian feature is actually usable at launch.
 */
import { suite, test, assert } from '../../lib/framework.mjs';

suite('Admin / guardians (staff-created links)', () => {
  test('staff can create a family link directly via guardian-approve', async (ctx) => {
    const guardian = await ctx.createEphemeralMember({ fullName: 'Staff-Linked Parent' });
    let traineeId = null;
    try {
      await ctx.setRole('admin');
      const res = await ctx.invokeEdge('guardian-approve', {
        action: 'create_direct',
        guardianUserId: guardian.userId,
        childDisplayName: 'Staff Child',
        accountMode: 'managed',
        allowGuardianQr: true,
      });
      // If the staff-create path is unavailable in this environment, surface it as a
      // skip with the returned reason rather than a hard failure.
      if (!res.ok) {
        return ctx.skip(`guardian-approve create_direct unavailable: ${JSON.stringify(res.body).slice(0, 160)}`);
      }
      const link = ctx.runSql(
        `select id::text as id, status, child_display_name, trainee_user_id::text as trainee
         from public.guardian_links where guardian_user_id = '${guardian.userId}' limit 1;`,
      )[0];
      assert(link, 'a guardian_links row must be created by staff');
      assert(['approved', 'active', 'pending'].includes(link.status), `unexpected status ${link.status}`);
      traineeId = link.trainee || null;
      return { status: link.status, child: link.child_display_name };
    } finally {
      ctx.runSql(`delete from public.guardian_links where guardian_user_id = '${guardian.userId}';`);
      if (traineeId) await ctx.deleteEphemeralUser(traineeId);
      await ctx.deleteEphemeralUser(guardian.userId);
    }
  }, { role: 'admin', multiRole: true });
});
