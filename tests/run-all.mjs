#!/usr/bin/env node
/**
 * 971 MMA — End-to-end regression runner.
 *
 * Discovers every `*.test.mjs` under tests/mobile-app and tests/admin, runs them
 * sequentially against the LIVE linked Supabase project using a single shared auth
 * session whose role is flipped (member ↔ coach ↔ gate ↔ admin) as each scenario
 * requires, then writes JSON + Markdown reports and exits non-zero on any failure.
 *
 * Usage:
 *   node tests/run-all.mjs                 # everything
 *   node tests/run-all.mjs --area=mobile-app
 *   node tests/run-all.mjs --area=admin
 *   node tests/run-all.mjs --grep=redemption
 *   node tests/run-all.mjs --list          # list cases without running
 *
 * Prereqs (already present in this repo): supabase CLI linked, .env +
 * supabase/.env.local with EXPO_PUBLIC_SUPABASE_URL/ANON_KEY + TEST_USER_*.
 */
import { readdirSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve, relative } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { getRegistry, setArea, SkipError, skip } from './lib/framework.mjs';
import {
  createHarness,
  runSql,
  createEphemeralMember,
  deleteEphemeralUser,
  createTestReward,
  deleteTestReward,
  getAccountBalance,
  ensureBalanceAtLeast,
  reverseBalanceTopUp,
  findOtherMember,
  resolveGymDayProbeClass,
  restoreProbeClassStartsAt,
  cleanupRollCallProbe,
  callEdgePublic,
  emailForUser,
  findAdmin,
  signInRaw,
  rpcAs,
  delay,
} from './lib/harness.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_TIMEOUT_MS = 150_000;

const args = process.argv.slice(2);
const areaFilter = args.find((a) => a.startsWith('--area='))?.split('=')[1] ?? null;
const grep = args.find((a) => a.startsWith('--grep='))?.split('=')[1] ?? null;
const listOnly = args.includes('--list');

function discover(area) {
  const root = resolve(__dirname, area);
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries.sort()) {
      const full = resolve(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.test.mjs')) out.push(full);
    }
  };
  walk(root);
  return out;
}

async function loadFiles() {
  for (const area of ['mobile-app', 'admin']) {
    if (areaFilter && area !== areaFilter) continue;
    setArea(area);
    for (const file of discover(area)) {
      await import(pathToFileURL(file).href);
    }
  }
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`TIMEOUT after ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function main() {
  await loadFiles();

  let cases = getRegistry();
  if (grep) {
    const needle = grep.toLowerCase();
    cases = cases.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.suite.toLowerCase().includes(needle) ||
        c.area.toLowerCase().includes(needle),
    );
  }

  console.log(`971 MMA E2E regression — ${cases.length} cases`);
  console.log('='.repeat(60));

  if (listOnly) {
    let area = '';
    for (const c of cases) {
      if (c.area !== area) {
        area = c.area;
        console.log(`\n[${area}]`);
      }
      console.log(`  • ${c.suite} › ${c.name}${c.role ? `  (role: ${c.role})` : ''}`);
    }
    console.log(`\nTotal: ${cases.length} cases`);
    return;
  }

  const h = createHarness();
  await h.signIn();
  console.log(`Signed in as test user ${h.userId} (real role: ${h.originalRole})`);

  const state = { role: h.originalRole };
  const ephemerals = new Set();

  const ctx = {
    h,
    env: h.env,
    runSql: (s) => runSql(s, h.env),
    invokeEdge: (name, body, token) => h.invokeEdge(name, body, token),
    get userId() {
      return h.userId;
    },
    async setRole(role) {
      if (state.role !== role) {
        await h.setRole(role);
        state.role = role;
      }
    },
    // multi-actor / fixture helpers (bound to harness)
    async createEphemeralMember(opts) {
      const m = await createEphemeralMember(h, opts);
      ephemerals.add(m.userId);
      return m;
    },
    async deleteEphemeralUser(userId) {
      await deleteEphemeralUser(h, userId);
      ephemerals.delete(userId);
    },
    createTestReward: (opts) => createTestReward(h, opts),
    deleteTestReward: (id) => deleteTestReward(h, id),
    getAccountBalance: (uid) => getAccountBalance(h, uid),
    ensureBalanceAtLeast: (uid, target) => ensureBalanceAtLeast(h, uid, target),
    reverseBalanceTopUp: (uid, delta) => reverseBalanceTopUp(h, uid, delta),
    findOtherMember: () => findOtherMember(h),
    resolveGymDayProbeClass,
    restoreProbeClassStartsAt,
    cleanupRollCallProbe: (classId) => cleanupRollCallProbe(classId),
    callEdgePublic: (name, body) => callEdgePublic(h.env, name, body),
    emailForUser: (uid) => emailForUser(h, uid),
    findAdmin: () => findAdmin(h),
    signInRaw: (email, password) => signInRaw(h.env, email, password),
    rpcAs: (token, fn, fnArgs) => rpcAs(h.env, token, fn, fnArgs),
    skip,
    delay,
  };

  const results = [];
  const started = Date.now();

  for (const c of cases) {
    const label = `${c.area} › ${c.suite} › ${c.name}`;
    const t0 = Date.now();
    try {
      if (c.role) await ctx.setRole(c.role);
      const data = await withTimeout(Promise.resolve(c.fn(ctx)), TEST_TIMEOUT_MS, label);
      results.push({ ...meta(c), status: 'PASS', durationMs: Date.now() - t0, data: trimData(data) });
      console.log(`  ✅ ${label}`);
    } catch (err) {
      if (err instanceof SkipError || err?.isSkip) {
        results.push({ ...meta(c), status: 'SKIP', durationMs: Date.now() - t0, reason: err.message });
        console.log(`  ⏭️  ${label} — SKIP: ${err.message}`);
      } else {
        results.push({
          ...meta(c),
          status: 'FAIL',
          durationMs: Date.now() - t0,
          error: (err?.stack || err?.message || String(err)).slice(0, 2000),
        });
        console.log(`  ❌ ${label}\n       ${(err?.message || err).toString().split('\n').join('\n       ')}`);
      }
      // A scenario may have left the shared session in an unexpected role.
      state.role = 'unknown';
    }
  }

  // ---- teardown: drop leftover ephemerals, force the shared user back to member ----
  for (const userId of ephemerals) {
    try {
      await deleteEphemeralUser(h, userId);
    } catch {
      /* best effort */
    }
  }
  try {
    // Restore the shared test user to the role it had at sign-in (it is an admin
    // account deliberately used so role-flipping can exercise every role).
    await h.admin.from('profiles').update({ role: h.originalRole }).eq('id', h.userId);
    await h.supabase.auth.signOut();
  } catch {
    /* best effort */
  }

  writeReports(results, Date.now() - started);

  const fail = results.filter((r) => r.status === 'FAIL').length;
  const pass = results.filter((r) => r.status === 'PASS').length;
  const skipCount = results.filter((r) => r.status === 'SKIP').length;
  console.log('\n' + '='.repeat(60));
  console.log(`PASS ${pass}   FAIL ${fail}   SKIP ${skipCount}   (${cases.length} total)`);
  console.log(`Report: ${resolve(__dirname, 'output/REPORT.md')}`);
  if (fail > 0) process.exitCode = 1;
}

function meta(c) {
  return { area: c.area, suite: c.suite, name: c.name, role: c.role, tags: c.tags };
}

function trimData(data) {
  if (data == null) return undefined;
  try {
    const s = JSON.stringify(data);
    return s.length > 600 ? s.slice(0, 600) + '…' : JSON.parse(s);
  } catch {
    return undefined;
  }
}

function writeReports(results, totalMs) {
  const outDir = resolve(__dirname, 'output');
  mkdirSync(outDir, { recursive: true });
  const summary = {
    total: results.length,
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
    skip: results.filter((r) => r.status === 'SKIP').length,
  };
  const json = { generatedAt: new Date().toISOString(), durationMs: totalMs, summary, results };
  writeFileSync(resolve(outDir, 'latest.json'), JSON.stringify(json, null, 2));

  const lines = [];
  lines.push('# 971 MMA — E2E Regression Report');
  lines.push('');
  lines.push(`Generated: ${json.generatedAt}`);
  lines.push(`Duration: ${(totalMs / 1000).toFixed(1)}s`);
  lines.push('');
  lines.push(`**PASS ${summary.pass} · FAIL ${summary.fail} · SKIP ${summary.skip}** of ${summary.total}`);
  lines.push('');
  let area = '';
  let suite = '';
  for (const r of results) {
    if (r.area !== area) {
      area = r.area;
      lines.push(`\n## ${area}`);
      suite = '';
    }
    if (r.suite !== suite) {
      suite = r.suite;
      lines.push(`\n### ${suite}`);
      lines.push('');
      lines.push('| Status | Scenario | Role | ms | Notes |');
      lines.push('| --- | --- | --- | --- | --- |');
    }
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
    const note = (r.error || r.reason || (r.data ? JSON.stringify(r.data) : '') || '')
      .toString()
      .replace(/\n/g, ' ')
      .slice(0, 160);
    lines.push(`| ${icon} | ${r.name} | ${r.role ?? '-'} | ${r.durationMs} | ${note} |`);
  }
  writeFileSync(resolve(outDir, 'REPORT.md'), lines.join('\n'));
}

main().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(2);
});
