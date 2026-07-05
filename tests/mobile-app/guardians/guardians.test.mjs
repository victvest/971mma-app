/**
 * Mobile app — Guardian / child trainee linking.
 *
 * A parent (guardian) requests a link to a child trainee. In "managed" mode the
 * child is represented by a profile the guardian operates. Approval is a staff
 * action. Covers: request creation, ownership, and that an unapproved link does
 * not grant proxy authority.
 */
import { suite, test, assert, assertEqual } from '../../lib/framework.mjs';

suite('Guardians / child link request', () => {
  // PRODUCT BEHAVIOR (verified, see TEST-NOTES): self-service child linking from the
  // mobile app is intentionally DISABLED — request_child_link rejects members with
  // STAFF_MANAGED_ONLY. Family trainee links are created by staff in the admin panel.
  // This test pins that contract so a regression that silently opens self-service
  // (or breaks the guard) is caught.
  test('self-service child link is blocked — staff-managed only', async (ctx) => {
    const guardian = await ctx.createEphemeralMember({ fullName: 'Parent One' });
    try {
      const { token } = await ctx.signInRaw(guardian.email, guardian.password);
      const res = await ctx.rpcAs(token, 'request_child_link', {
        p_child_name: 'Little Fighter',
        p_account_mode: 'managed',
      });
      assert(!res.ok, 'a member must not be able to self-create a child link');
      const code = res.error?.message || res.error?.code || JSON.stringify(res.error);
      assert(/STAFF_MANAGED_ONLY/.test(code), `expected STAFF_MANAGED_ONLY, got ${code}`);
      const leaked = ctx.runSql(
        `select count(*)::int as n from public.guardian_links where guardian_user_id = '${guardian.userId}';`,
      )[0].n;
      assertEqual(leaked, 0, 'no guardian_links row should be created by a blocked request');
    } finally {
      ctx.runSql(`delete from public.guardian_links where guardian_user_id = '${guardian.userId}';`);
      await ctx.deleteEphemeralUser(guardian.userId);
    }
  });

  test('a guardian link grants proxy authority only once approved', async (ctx) => {
    const guardian = await ctx.createEphemeralMember({ fullName: 'Parent Two' });
    const child = await ctx.createEphemeralMember({ fullName: 'Child Two' });
    try {
      // Staff-managed link, initially PENDING (unapproved).
      ctx.runSql(
        `insert into public.guardian_links (guardian_user_id, trainee_user_id, status, child_display_name)
         values ('${guardian.userId}', '${child.userId}', 'pending', 'Child Two');`,
      );
      // is_approved_guardian_of() resolves the guardian from auth.uid(), so call it
      // AS the guardian against the child target.
      const { token } = await ctx.signInRaw(guardian.email, guardian.password);
      const pending = await ctx.rpcAs(token, 'is_approved_guardian_of', { p_target: child.userId });
      assertEqual(pending.data, false, 'a pending link must NOT grant proxy authority');

      // Staff approves the link.
      ctx.runSql(
        `update public.guardian_links set status = 'approved', approved_at = now()
         where guardian_user_id = '${guardian.userId}' and trainee_user_id = '${child.userId}';`,
      );
      const approved = await ctx.rpcAs(token, 'is_approved_guardian_of', { p_target: child.userId });
      assertEqual(approved.data, true, 'an approved link must grant proxy authority');
    } finally {
      ctx.runSql(`delete from public.guardian_links where guardian_user_id = '${guardian.userId}';`);
      await ctx.deleteEphemeralUser(child.userId);
      await ctx.deleteEphemeralUser(guardian.userId);
    }
  });
});
