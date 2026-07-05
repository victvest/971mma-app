/**
 * Minimal sequential test framework for the 971 MMA end-to-end regression suite.
 *
 * Why custom (not jest): every test runs against the LIVE linked Supabase project
 * and shares ONE auth session whose role is flipped between member/coach/gate/admin.
 * That demands strict sequential execution and a shared context object — exactly
 * what jest's parallel/isolated model fights against. This file is ~150 lines and
 * does precisely what the suite needs.
 *
 * Test files register cases at import time:
 *
 *   import { suite, test } from '../../lib/framework.mjs';
 *   suite('Auth', () => {
 *     test('member can sign in', async (ctx) => { ... }, { role: 'member' });
 *   });
 *
 * The runner (run-all.mjs) imports every *.test.mjs (side-effect registration),
 * then executes the accumulated registry in order.
 */

const registry = [];
let currentSuite = 'ungrouped';
let currentArea = 'unknown';

/** Set by the runner before importing each file so reports can group by area/file. */
export function setArea(area) {
  currentArea = area;
}

export function suite(name, fn) {
  const prev = currentSuite;
  currentSuite = name;
  fn();
  currentSuite = prev;
}

/**
 * Register a test case.
 * @param {string} name
 * @param {(ctx: import('./harness.mjs').TestContext) => Promise<any>} fn
 * @param {{ role?: 'member'|'coach'|'gate'|'admin', multiRole?: boolean, tags?: string[] }} [opts]
 */
export function test(name, fn, opts = {}) {
  registry.push({
    area: currentArea,
    suite: currentSuite,
    name,
    fn,
    role: opts.role ?? null,
    multiRole: Boolean(opts.multiRole),
    tags: opts.tags ?? [],
  });
}

export class SkipError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'SkipError';
    this.isSkip = true;
  }
}

/** Throw to mark the current test SKIPPED (e.g. precondition/feature flag absent). */
export function skip(reason) {
  throw new SkipError(reason);
}

export function getRegistry() {
  return registry;
}

// ---------------------------------------------------------------------------
// Assertions — tiny, dependency-free.
// ---------------------------------------------------------------------------

export function assert(cond, message) {
  if (!cond) throw new Error(message || 'Assertion failed');
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message || 'Expected values to be equal'}\n   expected: ${stringify(expected)}\n   actual:   ${stringify(actual)}`,
    );
  }
}

export function assertNotEqual(actual, forbidden, message) {
  if (actual === forbidden) {
    throw new Error(`${message || 'Expected values to differ'} (both = ${stringify(actual)})`);
  }
}

export function assertIncludes(haystack, needle, message) {
  const ok =
    typeof haystack === 'string'
      ? haystack.includes(needle)
      : Array.isArray(haystack) && haystack.includes(needle);
  if (!ok) throw new Error(`${message || 'Expected to include'} ${stringify(needle)} in ${stringify(haystack)}`);
}

export function assertGreaterOrEqual(actual, floor, message) {
  if (!(actual >= floor)) {
    throw new Error(`${message || 'Expected >='} ${stringify(floor)}, got ${stringify(actual)}`);
  }
}

/** Asserts an async fn rejects/returns a Supabase error whose message contains `codeOrText`. */
export async function assertRejects(promiseOrFn, codeOrText, message) {
  let threw = null;
  try {
    const v = typeof promiseOrFn === 'function' ? await promiseOrFn() : await promiseOrFn;
    // Supabase rpc() resolves with { error } instead of throwing.
    if (v && typeof v === 'object' && 'error' in v && v.error) {
      threw = v.error;
    }
  } catch (e) {
    threw = e;
  }
  if (!threw) throw new Error(`${message || 'Expected rejection'} — but call succeeded`);
  if (codeOrText) {
    const text = `${threw.message ?? ''} ${threw.code ?? ''} ${stringify(threw)}`;
    if (!text.includes(codeOrText)) {
      throw new Error(`${message || 'Expected error to include'} "${codeOrText}", got: ${text.slice(0, 300)}`);
    }
  }
  return threw;
}

function stringify(v) {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
