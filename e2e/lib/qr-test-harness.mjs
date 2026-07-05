/**
 * Shared harness for QR workflow E2E simulation (no device required).
 * Invokes live Supabase Edge Functions + DB assertions against linked project.
 */
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { loadE2EEnv, appRoot, outputRoot } from './env.mjs';

export const ACADEMY_LAT = 25.1309;
export const ACADEMY_LNG = 55.2320;
export const FAR_LAT = ACADEMY_LAT + 0.05;
export const FAR_LNG = ACADEMY_LNG + 0.05;
export const GATE_LOCATION_ID = '971mma-al-quoz';
export const CHECK_IN_POINTS = 10;

export function loadQrEnv() {
  const env = loadE2EEnv();
  return {
    ...env,
    ACADEMY_LAT: Number(env.ACADEMY_LAT ?? ACADEMY_LAT),
    ACADEMY_LNG: Number(env.ACADEMY_LNG ?? ACADEMY_LNG),
    GATE_LOCATION_ID: env.GATE_LOCATION_ID ?? GATE_LOCATION_ID,
  };
}

export function runSql(sql, env = loadQrEnv()) {
  const output = execSync('supabase db query --linked -o json', {
    cwd: appRoot,
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
  const parsed = JSON.parse(output);
  return parsed.rows ?? parsed;
}

function resolveServiceRoleKey(env) {
  if (env.SUPABASE_SERVICE_ROLE_KEY) return env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const output = execSync('supabase projects api-keys --project-ref nzbbpduwahcncyvyjusj', {
      cwd: appRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(output).keys?.find((entry) => entry.name === 'service_role')?.api_key ?? null;
  } catch {
    return null;
  }
}

export function createHarness(env = loadQrEnv()) {
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const email = env.TEST_USER_EMAIL;
  const password = env.TEST_USER_PASSWORD;

  if (!supabaseUrl || !anonKey || !email || !password) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL, ANON_KEY, or TEST_USER credentials.');
  }

  const serviceRoleKey = resolveServiceRoleKey(env);
  if (!serviceRoleKey) throw new Error('Unable to resolve SUPABASE_SERVICE_ROLE_KEY.');

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId = null;
  let accessToken = null;
  let originalRole = 'member';

  async function signIn() {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      throw new Error(`Sign-in failed: ${error?.message ?? 'no session'}`);
    }
    userId = data.user.id;
    accessToken = data.session.access_token;
    originalRole =
      runSql(`select role from public.profiles where id = '${userId}';`, env)[0]?.role ?? 'member';
    return { userId, token: accessToken, originalRole };
  }

  async function setRole(role) {
    await admin.from('profiles').update({ role }).eq('id', userId);
    await supabase.auth.signOut();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error(`Re-sign-in as ${role} failed: ${error?.message}`);
    accessToken = data.session.access_token;
  }

  async function restoreRole() {
    await admin.from('profiles').update({ role: originalRole }).eq('id', userId);
    await supabase.auth.signOut();
  }

  async function invokeEdge(name, body, token = accessToken) {
    const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
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

  function clearTodayCheckIns(targetUserId = userId) {
    runSql(
      `
      delete from public.check_ins
      where user_id = '${targetUserId}'
        and checked_in_at >= (date_trunc('day', now() at time zone 'Asia/Dubai') at time zone 'Asia/Dubai');
    `,
      env,
    );
  }

  function getPointsBalance(targetUserId = userId) {
    const cache =
      runSql(
        `select balance from public.points_balance_cache where user_id = '${targetUserId}' limit 1;`,
        env,
      )[0]?.balance ?? null;
    if (cache !== null) return cache;
    return (
      runSql(
        `select balance from public.points_accounts where user_id = '${targetUserId}' limit 1;`,
        env,
      )[0]?.balance ?? 0
    );
  }

  function getLatestCheckIn(targetUserId = userId) {
    return runSql(
      `select id, method, gate_jti::text as gate_jti, user_id::text as user_id, presented_by::text as presented_by
       from public.check_ins where user_id = '${targetUserId}' order by checked_in_at desc limit 1;`,
      env,
    )[0];
  }

  function getStreak(targetUserId = userId) {
    return runSql(
      `select current_streak from public.member_streaks where user_id = '${targetUserId}' limit 1;`,
      env,
    )[0]?.current_streak;
  }

  function findSecondMember() {
    return runSql(
      `select id from public.profiles where role = 'member' and id != '${userId}' order by created_at limit 1;`,
      env,
    )[0]?.id;
  }

  async function issueGateQr(deviceLabel = 'qr-test-harness') {
    const result = await invokeEdge('gate-qr-issue', { deviceLabel });
    if (!result.ok || !result.body?.token) {
      throw new Error(`gate-qr-issue failed: ${JSON.stringify(result.body)}`);
    }
    return result.body;
  }

  async function issueMemberQr(targetUserId) {
    const body = targetUserId ? { targetUserId } : {};
    const result = await invokeEdge('qr-issue', body);
    if (!result.ok || !result.body?.token) {
      throw new Error(`qr-issue failed: ${JSON.stringify(result.body)}`);
    }
    return result.body;
  }

  return {
    env,
    supabase,
    admin,
    supabaseUrl,
    get userId() {
      return userId;
    },
    get token() {
      return accessToken;
    },
    get originalRole() {
      return originalRole;
    },
    signIn,
    setRole,
    restoreRole,
    invokeEdge,
    clearTodayCheckIns,
    getPointsBalance,
    getLatestCheckIn,
    getStreak,
    findSecondMember,
    issueGateQr,
    issueMemberQr,
  };
}

export function toBase64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function signGateToken(locationId, expEpoch, jti, secret) {
  const payload = `gate:${locationId}:${expEpoch}:${jti}`;
  const sig = toBase64Url(createHmac('sha256', secret).update(payload).digest());
  return `971mma:v2:gate:${locationId}:${expEpoch}:${jti}:${sig}`;
}

export function signMemberToken(memberId, expEpoch, jti, secret) {
  const payload = `supabase:${memberId}:${expEpoch}:${jti}`;
  const sig = toBase64Url(createHmac('sha256', secret).update(payload).digest());
  return `971mma:v2:supabase:${memberId}:${expEpoch}:${jti}:${sig}`;
}

/** Mirrors coach scanner client logic — extract memberId from scanned payload. */
export function simulateCoachScannerParse(raw) {
  const parts = raw.trim().split(':');
  if (parts.length < 2 || parts[0] !== '971mma') return null;
  if (parts[1] === 'v1' && parts.length === 4) {
    return { memberId: parts[3], source: parts[2] };
  }
  if (parts[1] === 'v2' && parts.length === 7 && (parts[2] === 'supabase' || parts[2] === 'mindbody')) {
    return { memberId: parts[3], source: parts[2], exp: parseInt(parts[4], 10) };
  }
  return null;
}

/** Mirrors EntranceScanner client rejection of member pass at gate. */
export function simulateEntranceScannerReject(raw) {
  const parts = raw.trim().split(':');
  if (parts.length < 3 || parts[0] !== '971mma') return 'invalid_format';
  const kind = parts[2];
  if (kind === 'supabase' || kind === 'mindbody') return 'member_pass_at_gate';
  if (kind !== 'gate') return 'invalid_format';
  if (parts.length !== 7) return 'invalid_format';
  return null;
}

export function rollCallSchemaReady(env = loadQrEnv()) {
  try {
    const cols = runSql(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'roll_call_settings'
         and column_name in ('notify_member_on_present', 'notify_member_present');`,
      env,
    );
    return cols.length > 0;
  } catch {
    return false;
  }
}

export function assertErrorCode(result, code) {
  const actual = result.body?.error?.code;
  if (actual !== code) {
    throw new Error(`Expected error code ${code}, got ${actual}: ${JSON.stringify(result.body)}`);
  }
}

export function writeReport(results) {
  const reportDir = resolve(outputRoot, 'qr-suite');
  mkdirSync(reportDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: results.length,
      passed: results.filter((r) => r.status === 'PASS').length,
      failed: results.filter((r) => r.status === 'FAIL').length,
      skipped: results.filter((r) => r.status === 'SKIP').length,
    },
    scenarios: results,
  };
  writeFileSync(resolve(reportDir, 'latest.json'), JSON.stringify(report, null, 2));
  return report;
}
