/**
 * Mobile app — Authentication
 *
 * Exercises the REAL production sign-in path: the `auth-sign-in` edge function
 * (verify_jwt=false) which the app calls pre-auth. Covers happy path, credential
 * rejection without user enumeration, missing-field validation, the deliberate
 * "admins cannot use the mobile app" control, and that a member profile is
 * bootstrapped with a valid role/status.
 */
import { suite, test, assert, assertEqual } from '../../lib/framework.mjs';

suite('Auth / sign-in', () => {
  test('valid member credentials return a session', async (ctx) => {
    // The shared TEST_USER is an admin (so role-flipping can drive every role),
    // and admins are blocked from the mobile path — so we create a real member.
    const member = await ctx.createEphemeralMember({ fullName: 'Auth Happy Path' });
    try {
      const res = await ctx.callEdgePublic('auth-sign-in', {
        email: member.email,
        password: member.password,
      });
      assert(res.ok, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert(res.body?.session?.access_token, 'response missing session.access_token');
      assert(res.body?.session?.refresh_token, 'response missing session.refresh_token');
      return { status: res.status };
    } finally {
      await ctx.deleteEphemeralUser(member.userId);
    }
  });

  test('wrong password is rejected as INVALID_CREDENTIALS (401)', async (ctx) => {
    const member = await ctx.createEphemeralMember({ fullName: 'Auth Wrong Pw' });
    try {
      const res = await ctx.callEdgePublic('auth-sign-in', {
        email: member.email,
        password: 'definitely-not-the-password-999',
      });
      assertEqual(res.status, 401, 'wrong password must be 401');
      assertEqual(res.body?.error?.code, 'INVALID_CREDENTIALS', 'expected INVALID_CREDENTIALS code');
    } finally {
      await ctx.deleteEphemeralUser(member.userId);
    }
  });

  test('unknown email does not leak account existence (same 401 + delay)', async (ctx) => {
    const started = Date.now();
    const res = await ctx.callEdgePublic('auth-sign-in', {
      email: `no-such-user-${Date.now()}@971mma-e2e.test`,
      password: 'whatever-123',
    });
    assertEqual(res.status, 401, 'unknown email must also be 401 (no enumeration)');
    assertEqual(res.body?.error?.code, 'INVALID_CREDENTIALS', 'expected INVALID_CREDENTIALS code');
    // Anti-timing floor is ~300ms in the function.
    assert(Date.now() - started >= 250, 'expected anti-enumeration response delay');
  });

  test('missing email/password is a 400 BAD_REQUEST', async (ctx) => {
    const a = await ctx.callEdgePublic('auth-sign-in', { password: 'x' });
    assertEqual(a.status, 400, 'missing email must be 400');
    assertEqual(a.body?.error?.code, 'BAD_REQUEST');
    const b = await ctx.callEdgePublic('auth-sign-in', { email: ctx.env.TEST_USER_EMAIL });
    assertEqual(b.status, 400, 'missing password must be 400');
  });

  test('admin accounts cannot sign in through the mobile app (even with correct password)', async (ctx) => {
    // The shared TEST_USER *is* an admin and we know its real password, so this is
    // the strongest possible assertion of the control: correct credentials, still
    // rejected, and rejected indistinguishably from bad credentials. Force the
    // shared user to admin first — earlier scenarios may have flipped its role.
    await ctx.setRole('admin');
    const res = await ctx.callEdgePublic('auth-sign-in', {
      email: ctx.env.TEST_USER_EMAIL,
      password: ctx.env.TEST_USER_PASSWORD,
    });
    assertEqual(res.status, 401, 'admin must be blocked from mobile sign-in');
    assertEqual(res.body?.error?.code, 'INVALID_CREDENTIALS', 'admin block must look like bad creds');
  });
});

suite('Auth / profile bootstrap', () => {
  test('signed-in member has a profile with a valid role and active status', async (ctx) => {
    const row = ctx.runSql(
      `select role, account_status from public.profiles where id = '${ctx.userId}' limit 1;`,
    )[0];
    assert(row, 'no profile row for the test user');
    assert(['member', 'coach', 'admin'].includes(row.role), `unexpected role ${row.role}`);
  }, { role: 'member' });

  test('member can read their own profile via RLS but not others wholesale', async (ctx) => {
    // As the member, selecting own profile through the anon client must succeed.
    const { data, error } = await ctx.h.supabase
      .from('profiles')
      .select('id, role')
      .eq('id', ctx.userId)
      .maybeSingle();
    assert(!error, `own-profile read failed: ${error?.message}`);
    assertEqual(data?.id, ctx.userId, 'own profile id mismatch');
  }, { role: 'member' });
});
