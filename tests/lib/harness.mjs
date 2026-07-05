/**
 * Harness wrapper for the end-to-end regression suite.
 *
 * Re-exports the PROVEN live-backend harness that already ships in
 * 971mma-app/e2e/lib (createHarness, runSql, token signers, scanner simulators)
 * so this suite reuses the same Supabase link, service-role resolution, and
 * role-flipping machinery instead of reinventing it. Adds a few higher-level
 * helpers used across many scenarios (ephemeral members, test rewards, points
 * top-up/restore, roll-call probe class).
 *
 * Bare npm specifiers (@supabase/supabase-js) are NOT imported here — they are
 * resolved inside e2e/lib/* which lives next to 971mma-app/node_modules. That is
 * what lets this top-level suite run with `node` from anywhere.
 */
import {
  createHarness,
  runSql,
  loadQrEnv,
  ACADEMY_LAT,
  ACADEMY_LNG,
  FAR_LAT,
  FAR_LNG,
  GATE_LOCATION_ID,
  CHECK_IN_POINTS,
  signGateToken,
  signMemberToken,
  simulateCoachScannerParse,
  simulateEntranceScannerReject,
  rollCallSchemaReady,
} from '../../e2e/lib/qr-test-harness.mjs';
import {
  resolveGymDayProbeClass,
  restoreProbeClassStartsAt,
  cleanupRollCallProbe,
} from '../../scripts/rollCallVerifyEnv.mjs';

export {
  createHarness,
  runSql,
  loadQrEnv,
  ACADEMY_LAT,
  ACADEMY_LNG,
  FAR_LAT,
  FAR_LNG,
  GATE_LOCATION_ID,
  CHECK_IN_POINTS,
  signGateToken,
  signMemberToken,
  simulateCoachScannerParse,
  simulateEntranceScannerReject,
  rollCallSchemaReady,
  resolveGymDayProbeClass,
  restoreProbeClassStartsAt,
  cleanupRollCallProbe,
};

const EPHEMERAL_DOMAIN = '971mma-e2e.test';

/** SQL-escape a string literal. */
export function sql(value) {
  return String(value).replace(/'/g, "''");
}

async function bootstrapProfile(h, userId, { role, accountStatus, fullName }) {
  let exists = false;
  for (let i = 0; i < 20; i += 1) {
    const row = runSql(`select id from public.profiles where id = '${userId}';`, h.env)[0];
    if (row?.id) {
      exists = true;
      break;
    }
    await delay(150);
  }
  if (!exists) {
    runSql(
      `insert into public.profiles (id, role, account_status, full_name)
       values ('${userId}', '${sql(role)}', '${sql(accountStatus)}', '${sql(fullName)}')
       on conflict (id) do nothing;`,
      h.env,
    );
  }
  runSql(
    `update public.profiles set role = '${sql(role)}', account_status = '${sql(accountStatus)}', full_name = '${sql(fullName)}'
     where id = '${userId}';`,
    h.env,
  );
}

/**
 * Create or refresh a stable UI-test account (idempotent — safe to re-run).
 */
export async function ensureUiTestUser(
  h,
  { email, password, fullName = 'UI Test User', role = 'member', accountStatus = 'active' },
) {
  const { data, error } = await h.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  let userId = data?.user?.id ?? null;
  if (error) {
    const row = runSql(`select id from auth.users where email = '${sql(email)}';`, h.env)[0];
    if (!row?.id) {
      throw new Error(`ensureUiTestUser failed: ${error.message}`);
    }
    userId = row.id;
    const { error: updateError } = await h.admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (updateError) {
      throw new Error(`ensureUiTestUser password update failed: ${updateError.message}`);
    }
  }

  await bootstrapProfile(h, userId, { role, accountStatus, fullName });
  return { userId, email, password };
}

/**
 * Create a throwaway member (real auth user + bootstrapped profile) so multi-actor
 * scenarios never mutate real members. Caller MUST deleteEphemeralUser() in cleanup.
 */
export async function createEphemeralMember(h, { fullName = 'E2E Ephemeral', accountStatus = 'active' } = {}) {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `eph-${stamp}@${EPHEMERAL_DOMAIN}`;
  const password = `E2e!${stamp}aA`;
  const { data, error } = await h.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data?.user?.id) {
    throw new Error(`createEphemeralMember failed: ${error?.message ?? 'no user id'}`);
  }
  await bootstrapProfile(h, data.user.id, { role: 'member', accountStatus, fullName });
  return { userId: data.user.id, email, password };
}

/**
 * Hard-delete an ephemeral user and the rows that reference it. Safe to call twice.
 *
 * IMPORTANT: all dependent-row deletes run in ONE `supabase db query` invocation.
 * Each CLI call has a ~1-2s cold start, so the previous per-table loop (~14 calls)
 * made teardown the dominant cost and tripped the per-test timeout. Column names
 * are explicit because referrals/guardian_links do NOT key on `user_id`.
 */
export async function deleteEphemeralUser(h, userId) {
  if (!userId) return;
  const u = `'${userId}'`;
  const stmts = [
    `delete from public.points_ledger where user_id = ${u}`,
    `delete from public.points_accounts where user_id = ${u}`,
    `delete from public.points_balance_cache where user_id = ${u}`,
    `delete from public.redemptions where user_id = ${u}`,
    `delete from public.check_ins where user_id = ${u}`,
    `delete from public.class_session_attendance where user_id = ${u}`,
    `delete from public.discipline_scores where user_id = ${u}`,
    `delete from public.member_milestones where user_id = ${u}`,
    `delete from public.member_streaks where user_id = ${u}`,
    `delete from public.qr_tokens where user_id = ${u}`,
    `delete from public.notifications where user_id = ${u}`,
    `delete from public.notification_preferences where user_id = ${u}`,
    `delete from public.activation_requests where user_id = ${u}`,
    `delete from public.support_messages where user_id = ${u}`,
    `delete from public.account_deletion_requests where user_id = ${u}`,
    `delete from public.community_memberships where user_id = ${u}`,
    `delete from public.mindbody_links where user_id = ${u}`,
    `delete from public.referrals where referrer_user_id = ${u} or referred_user_id = ${u}`,
    `delete from public.guardian_links where guardian_user_id = ${u} or trainee_user_id = ${u}`,
  ];
  try {
    runSql(stmts.join(';\n') + ';', h.env);
  } catch {
    /* best effort — auth delete below + cascades cover the rest */
  }
  try {
    await h.admin.auth.admin.deleteUser(userId);
  } catch {
    runSql(`delete from public.profiles where id = '${userId}';`, h.env);
  }
}

/** Insert a disposable reward into the catalog. Returns its id. */
export function createTestReward(
  h,
  { name = `E2E Reward ${Date.now()}`, cost = 10, tier = null, inventory = null, active = true, category = 'gear' } = {},
) {
  // category must satisfy rewards_catalog_category_check: cafeteria|gear|coaching|events
  const unlock = tier ? `'{"requiresTier":"${sql(tier)}"}'::jsonb` : `'{}'::jsonb`;
  const inv = inventory === null ? 'null' : String(inventory);
  const row = runSql(
    `insert into public.rewards_catalog
       (name, category, cost_points, active, unlock_rule, fulfillment, inventory, sort_order)
     values ('${sql(name)}', '${sql(category)}', ${cost}, ${active}, ${unlock}, 'manual', ${inv}, 999)
     returning id::text as id;`,
    h.env,
  )[0];
  if (!row?.id) throw new Error('createTestReward: insert returned no id');
  return row.id;
}

export function deleteTestReward(h, rewardId) {
  if (!rewardId) return;
  runSql(
    `delete from public.redemptions where reward_id = '${rewardId}';
     delete from public.rewards_catalog where id = '${rewardId}';`,
    h.env,
  );
}

/** Current balance from points_accounts (the authoritative spendable balance). */
export function getAccountBalance(h, userId) {
  return (
    runSql(`select balance from public.points_accounts where user_id = '${userId}' limit 1;`, h.env)[0]
      ?.balance ?? 0
  );
}

/**
 * Ensure `userId` has at least `target` spendable points by writing a tracked
 * 'adjustment' ledger entry. Returns the delta added (0 if already sufficient) so
 * the caller can reverse it in cleanup.
 */
export function ensureBalanceAtLeast(h, userId, target) {
  runSql(
    `insert into public.points_accounts (user_id, balance, tier, lifetime_points, updated_at)
     values ('${userId}', 0, 'bronze', 0, now())
     on conflict (user_id) do nothing;`,
    h.env,
  );
  const current = getAccountBalance(h, userId);
  if (current >= target) return 0;
  const delta = target - current;
  runSql(
    `update public.points_accounts set balance = balance + ${delta}, updated_at = now()
     where user_id = '${userId}';`,
    h.env,
  );
  return delta;
}

/** Reverse a previous ensureBalanceAtLeast top-up. */
export function reverseBalanceTopUp(h, userId, delta) {
  if (!delta) return;
  runSql(
    `update public.points_accounts set balance = greatest(balance - ${delta}, 0), updated_at = now()
     where user_id = '${userId}';`,
    h.env,
  );
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call a public (verify_jwt=false) edge function the way the pre-auth mobile app
 * does — anon key as bearer + apikey header. Used for the real sign-in path.
 */
export async function callEdgePublic(env, name, body) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${anon}`,
      apikey: anon,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

/**
 * Sign in as an arbitrary account via GoTrue (does NOT touch the shared harness
 * session). Returns an access token usable with rpcAs/restAs so ephemeral members
 * can act as themselves for auth.uid()-based RPCs.
 */
export async function signInRaw(env, email, password) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`signInRaw failed for ${email}: ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  }
  return { token: body.access_token, userId: body.user?.id };
}

/** Call a SECURITY-aware RPC as a specific user token (auth.uid() resolves to them). */
export async function rpcAs(env, token, fn, args) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(args ?? {}),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data: res.ok ? data : null, error: res.ok ? null : data };
}

/** Look up an account email by user id (for the admin-blocked-from-mobile auth test). */
export function emailForUser(h, userId) {
  return runSql(
    `select email from auth.users where id = '${userId}' limit 1;`,
    h.env,
  )[0]?.email;
}

/** First admin account id (read-only; used to prove admins can't use the mobile login path). */
export function findAdmin(h) {
  return runSql(
    `select id::text as id from public.profiles where role = 'admin' order by created_at limit 1;`,
    h.env,
  )[0];
}

/** Find a real, active member that is NOT the shared test user (read-only scenarios). */
export function findOtherMember(h) {
  return runSql(
    `select id::text as id, full_name from public.profiles
     where role = 'member' and account_status = 'active' and id != '${h.userId}'
     order by created_at limit 1;`,
    h.env,
  )[0];
}
