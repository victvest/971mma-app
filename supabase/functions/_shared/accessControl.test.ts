// Gate access-decision tests for accessControl.ts.
//
// Run with:  deno test --allow-env supabase/functions/_shared/accessControl.test.ts
//
// NOTE: these require the Deno runtime (the edge functions import from esm.sh and use
// Deno.env). They are written for CI / any machine with Deno installed. They exercise
// the decision logic in evaluateGateAccess / evaluateGateAccessByMemberId against an
// in-memory fake of the Supabase query builder that models only the operations the
// code under test performs.
//
// Coverage:
//   - one-shot QR: a spent pass is denied re-entry (token_already_used)   [finding #2]
//   - reader retry: same member + same device within the window is granted (no re-write)
//   - unknown device is denied
//   - unlinked member is denied
//   - MemberId path (no jti) is unaffected by token consumption
//   - a successful first scan consumes the jti and records a check-in

import {
  assertEquals,
  assert,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

// Env required by memberQrToken (signing) and mindbody (mbFetch). Set before import.
Deno.env.set('QR_SIGNING_SECRET', 'test-secret');
Deno.env.set('SALTO_ALLOWED_DEVICE_IDS', 'reader-1');
Deno.env.set('MINDBODY_LOCATION_ID', '1');
Deno.env.set('MINDBODY_BASE_URL', 'https://mb.test');
Deno.env.set('MINDBODY_API_KEY', 'key');
Deno.env.set('MINDBODY_SITE_ID', '-99');
Deno.env.set('MINDBODY_SOURCE_NAME', 'src');
Deno.env.set('MINDBODY_SOURCE_PASSWORD', 'pw');

const { evaluateGateAccess, evaluateGateAccessByMemberId } = await import('./accessControl.ts');
const { signMemberQrToken } = await import('./memberQrToken.ts');

// Stub the HTTP layer so writeMindbodyArrival -> mbFetch -> fetch returns a fake Visit
// without a real network call. Both the token-issue and add-arrival endpoints are
// handled; everything else 404s. Toggle `arrivalStatus`/`arrivalBody` per test.
let arrivalStatus = 200;
let arrivalBody: unknown = { Visit: { Id: 987 } };
let liveMembershipBody: unknown = {
  ClientMemberships: [
    {
      Id: '1',
      Name: '2 Weeks Access',
      Current: true,
      Suspended: false,
      ExpirationDate: '2999-01-01T00:00:00Z',
    },
  ],
};

const originalFetch = globalThis.fetch;
globalThis.fetch = ((input: Request | URL | string) => {
  const url = typeof input === 'string' ? input : input.toString();
  if (url.includes('/usertoken/issue')) {
    return Promise.resolve(
      new Response(JSON.stringify({ AccessToken: 'tok', TokenType: 'Bearer', Expires: '2999-01-01T00:00:00Z' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }
  if (url.includes('/client/addarrival')) {
    return Promise.resolve(
      new Response(JSON.stringify(arrivalBody), {
        status: arrivalStatus,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }
  if (url.includes('/client/activeclientmemberships')) {
    return Promise.resolve(
      new Response(JSON.stringify(liveMembershipBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }
  if (url.includes('/client/clientcontracts')) {
    return Promise.resolve(
      new Response(JSON.stringify({ Contracts: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }
  return Promise.resolve(new Response('not found', { status: 404 }));
}) as typeof fetch;

globalThis.addEventListener?.('unload', () => {
  globalThis.fetch = originalFetch;
});

type Row = Record<string, unknown>;

/**
 * Minimal in-memory stand-in for the subset of the supabase-js query builder used by
 * accessControl.ts. Each table is an array of rows; filters are equality/`is null`.
 */
class FakeTable {
  constructor(public rows: Row[]) {}
}

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private updatePatch: Row | null = null;
  private insertRow: Row | null = null;
  private isUpsert = false;

  constructor(
    private table: FakeTable,
    private op: 'select' | 'insert' | 'update' | 'upsert',
    private nextId: () => string,
  ) {}

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    const set = new Set(values);
    this.filters.push((row) => set.has(row[column]));
    return this;
  }

  is(column: string, value: null) {
    this.filters.push((row) => row[column] === null || row[column] === undefined);
    return this;
  }

  gte(column: string, value: string) {
    this.filters.push((row) => String(row[column] ?? '') >= value);
    return this;
  }

  lte(column: string, value: string) {
    this.filters.push((row) => String(row[column] ?? '') <= value);
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  select() {
    return this;
  }

  private matching(): Row[] {
    return this.table.rows.filter((row) => this.filters.every((f) => f(row)));
  }

  async maybeSingle<T = Row>(): Promise<{ data: T | null; error: unknown }> {
    return await this.resolveSingle<T>(false);
  }

  async single<T = Row>(): Promise<{ data: T | null; error: unknown }> {
    return await this.resolveSingle<T>(true);
  }

  private async resolveSingle<T>(requireRow: boolean): Promise<{ data: T | null; error: unknown }> {
    if (this.op === 'insert' && this.insertRow) {
      const row = { id: this.nextId(), ...this.insertRow };
      this.table.rows.push(row);
      return { data: row as T, error: null };
    }

    if (this.op === 'update' && this.updatePatch) {
      const matches = this.matching();
      for (const row of matches) Object.assign(row, this.updatePatch);
      const first = matches[0] ?? null;
      return { data: (first as T) ?? null, error: null };
    }

    const first = this.matching()[0] ?? null;
    if (!first && requireRow) {
      return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    }
    return { data: (first as T) ?? null, error: null };
  }

  update(patch: Row) {
    this.op = 'update';
    this.updatePatch = patch;
    return this;
  }

  insert(row: Row) {
    this.op = 'insert';
    this.insertRow = row;
    return this;
  }

  // Model upsert as insert-if-absent by a best-effort primary-key match, and return the
  // real supabase shape ({ data, error }) so callers that destructure `{ error }` work.
  upsert(row: Row): Promise<{ data: null; error: null }> {
    const key = 'device_id' in row ? 'device_id' : 'id' in row ? 'id' : 'user_id';
    const existing = this.table.rows.find((r) => r[key] === row[key]);
    if (existing) Object.assign(existing, row);
    else this.table.rows.push({ id: this.nextId(), ...row });
    return Promise.resolve({ data: null, error: null });
  }
}

function makeFakeSvc(seed: Record<string, Row[]>) {
  const tables: Record<string, FakeTable> = {};
  for (const [name, rows] of Object.entries(seed)) tables[name] = new FakeTable(rows);
  let counter = 0;
  const nextId = () => `id-${++counter}`;

  return {
    _tables: tables,
    from(name: string) {
      const table = tables[name] ?? new FakeTable([]);
      tables[name] = table;
      const q = new FakeQuery(table, 'select', nextId);
      return q;
    },
    // assertQuota() calls svc.rpc('mb_increment_quota'); return a low count so the
    // quota gate always passes.
    rpc(_fn: string, _args?: Row) {
      return Promise.resolve({ data: 1, error: null });
    },
  };
}

function stubArrivalOk() {
  arrivalStatus = 200;
  arrivalBody = { Visit: { Id: 987 } };
}

function stubArrivalRequiresPayment() {
  arrivalStatus = 400;
  arrivalBody = { Error: { Message: 'Client requires payment.', Code: 'ValidationFailed' } };
}

// Valid UUID v4 (version nibble 4, variant nibble 8) so isUuid() in accessControl
// recognises it as a user id — real auth.users ids are v4.
const MEMBER_ID = '11111111-1111-4111-8111-111111111111';

function baseSeed(): Record<string, Row[]> {
  return {
    gate_devices: [{ id: 'd1', device_id: 'reader-1', enabled: true }],
    profiles: [
      {
        id: MEMBER_ID,
        full_name: 'Test Member',
        avatar_url: null,
        membership_status: 'active',
        membership_last_synced_at: null,
      },
    ],
    mindbody_links: [{ user_id: MEMBER_ID, mindbody_client_id: 'mb-1' }],
    gate_access_attempts: [],
    check_ins: [],
    qr_tokens: [],
  };
}

Deno.test('first scan of a fresh QR grants and consumes the token', async () => {
  stubArrivalOk();
  const exp = Math.floor(Date.now() / 1000) + 300;
  const jti = 'jti-fresh';
  const seed = baseSeed();
  seed.qr_tokens.push({ id: 'q1', jti, user_id: MEMBER_ID, expires_at: '', consumed_at: null });
  const svc = makeFakeSvc(seed);
  const token = await signMemberQrToken('supabase', MEMBER_ID, exp, jti);

  // deno-lint-ignore no-explicit-any
  const decision = await evaluateGateAccess({ svc: svc as any, deviceId: 'reader-1', token, rawType: 'QR' });

  assertEquals(decision.granted, true);
  assertEquals(decision.reasonCode, 'granted');
  const consumed = seed.qr_tokens.find((t) => t.jti === jti)?.consumed_at;
  assert(consumed, 'token should be consumed after a successful grant');
  assertEquals(seed.check_ins.length, 1);
});

Deno.test('a spent QR is denied re-entry (one-shot)', async () => {
  stubArrivalOk();
  const exp = Math.floor(Date.now() / 1000) + 300;
  const jti = 'jti-spent';
  const seed = baseSeed();
  // token already consumed, and the member has NOT checked in today
  seed.qr_tokens.push({
    id: 'q1',
    jti,
    user_id: MEMBER_ID,
    expires_at: '',
    consumed_at: new Date().toISOString(),
  });
  const svc = makeFakeSvc(seed);
  const token = await signMemberQrToken('supabase', MEMBER_ID, exp, jti);

  // deno-lint-ignore no-explicit-any
  const decision = await evaluateGateAccess({ svc: svc as any, deviceId: 'reader-1', token, rawType: 'QR' });

  assertEquals(decision.granted, false);
  assertEquals(decision.reasonCode, 'token_already_used');
  assertEquals(seed.check_ins.length, 0);
});

Deno.test('class roll-call today does not count as facility entry (still creates gate_scan)', async () => {
  stubArrivalOk();
  const exp = Math.floor(Date.now() / 1000) + 300;
  const jti = 'jti-after-class';
  const seed = baseSeed();
  seed.qr_tokens.push({ id: 'q1', jti, user_id: MEMBER_ID, expires_at: '', consumed_at: null });
  seed.check_ins.push({
    id: 'class-1',
    user_id: MEMBER_ID,
    method: 'coach_roster',
    class_id: 'class-xyz',
    checked_in_at: new Date().toISOString(),
  });
  const svc = makeFakeSvc(seed);
  const token = await signMemberQrToken('supabase', MEMBER_ID, exp, jti);

  // deno-lint-ignore no-explicit-any
  const decision = await evaluateGateAccess({ svc: svc as any, deviceId: 'reader-1', token, rawType: 'QR' });

  assertEquals(decision.granted, true);
  assertEquals(decision.reasonCode, 'granted');
  assertEquals(seed.check_ins.filter((row) => row.method === 'gate_scan').length, 1);
  assert(seed.qr_tokens.find((t) => t.jti === jti)?.consumed_at, 'QR must still be one-shot consumed');
});

Deno.test('spent QR stays denied even when member has class attendance today', async () => {
  stubArrivalOk();
  const exp = Math.floor(Date.now() / 1000) + 300;
  const jti = 'jti-spent-after-class';
  const seed = baseSeed();
  seed.qr_tokens.push({
    id: 'q1',
    jti,
    user_id: MEMBER_ID,
    expires_at: '',
    consumed_at: new Date().toISOString(),
  });
  seed.check_ins.push({
    id: 'class-1',
    user_id: MEMBER_ID,
    method: 'coach_roster',
    class_id: 'class-xyz',
    checked_in_at: new Date().toISOString(),
  });
  const svc = makeFakeSvc(seed);
  const token = await signMemberQrToken('supabase', MEMBER_ID, exp, jti);

  // deno-lint-ignore no-explicit-any
  const decision = await evaluateGateAccess({ svc: svc as any, deviceId: 'reader-1', token, rawType: 'QR' });

  assertEquals(decision.granted, false);
  assertEquals(decision.reasonCode, 'token_already_used');
  assertEquals(seed.check_ins.filter((row) => row.method === 'gate_scan').length, 0);
});

Deno.test('reader retry (recent granted attempt, same device + jti) is granted without re-write', async () => {
  stubArrivalOk();
  const exp = Math.floor(Date.now() / 1000) + 300;
  const jti = 'jti-retry';
  const seed = baseSeed();
  seed.qr_tokens.push({
    id: 'q1',
    jti,
    user_id: MEMBER_ID,
    expires_at: '',
    consumed_at: new Date().toISOString(),
  });
  // a granted attempt for this member+device+jti within the window
  seed.gate_access_attempts.push({
    id: 'a1',
    member_user_id: MEMBER_ID,
    device_id: 'reader-1',
    granted: true,
    token_jti: jti,
    responded_at: new Date().toISOString(),
  });
  const svc = makeFakeSvc(seed);
  const token = await signMemberQrToken('supabase', MEMBER_ID, exp, jti);

  // deno-lint-ignore no-explicit-any
  const decision = await evaluateGateAccess({ svc: svc as any, deviceId: 'reader-1', token, rawType: 'QR' });

  assertEquals(decision.granted, true);
  assertEquals(decision.reasonCode, 'duplicate_recent_grant');
  assertEquals(seed.check_ins.length, 0, 'retry must not create a second check-in');
});

Deno.test('fresh QR later the same day records another facility arrival', async () => {
  stubArrivalOk();
  const exp = Math.floor(Date.now() / 1000) + 300;
  const jti = 'jti-second-entry';
  const seed = baseSeed();
  seed.check_ins.push({
    id: 'gate-1',
    user_id: MEMBER_ID,
    method: 'gate_scan',
    class_id: null,
    checked_in_at: new Date().toISOString(),
  });
  seed.qr_tokens.push({ id: 'q2', jti, user_id: MEMBER_ID, expires_at: '', consumed_at: null });
  const svc = makeFakeSvc(seed);
  const token = await signMemberQrToken('supabase', MEMBER_ID, exp, jti);

  // deno-lint-ignore no-explicit-any
  const decision = await evaluateGateAccess({ svc: svc as any, deviceId: 'reader-1', token, rawType: 'QR' });

  assertEquals(decision.granted, true);
  assertEquals(decision.reasonCode, 'already_checked_in_today');
  assertEquals(seed.check_ins.filter((row) => row.method === 'gate_scan').length, 2);
  assert(seed.qr_tokens.find((t) => t.jti === jti)?.consumed_at, 'second QR must be consumed');
});

Deno.test('spent QR is denied even after an earlier facility arrival today', async () => {
  stubArrivalOk();
  const exp = Math.floor(Date.now() / 1000) + 300;
  const jti = 'jti-spent-after-facility';
  const seed = baseSeed();
  seed.check_ins.push({
    id: 'gate-1',
    user_id: MEMBER_ID,
    method: 'gate_scan',
    class_id: null,
    checked_in_at: new Date().toISOString(),
  });
  seed.qr_tokens.push({
    id: 'q1',
    jti,
    user_id: MEMBER_ID,
    expires_at: '',
    consumed_at: new Date().toISOString(),
  });
  const svc = makeFakeSvc(seed);
  const token = await signMemberQrToken('supabase', MEMBER_ID, exp, jti);

  // deno-lint-ignore no-explicit-any
  const decision = await evaluateGateAccess({ svc: svc as any, deviceId: 'reader-1', token, rawType: 'QR' });

  assertEquals(decision.granted, false);
  assertEquals(decision.reasonCode, 'token_already_used');
  assertEquals(seed.check_ins.filter((row) => row.method === 'gate_scan').length, 1);
});

Deno.test('unknown device is denied', async () => {
  stubArrivalOk();
  const exp = Math.floor(Date.now() / 1000) + 300;
  const seed = baseSeed();
  seed.gate_devices = []; // no registered device
  Deno.env.set('SALTO_ALLOWED_DEVICE_IDS', ''); // and not in the allowlist
  const svc = makeFakeSvc(seed);
  const token = await signMemberQrToken('supabase', MEMBER_ID, exp, 'jti-x');

  // deno-lint-ignore no-explicit-any
  const decision = await evaluateGateAccess({ svc: svc as any, deviceId: 'ghost', token, rawType: 'QR' });

  assertEquals(decision.granted, false);
  assertEquals(decision.reasonCode, 'device_unknown');
  Deno.env.set('SALTO_ALLOWED_DEVICE_IDS', 'reader-1'); // restore
});

Deno.test('requires-payment arrival grants when live membership is active', async () => {
  stubArrivalRequiresPayment();
  const seed = baseSeed();
  const svc = makeFakeSvc(seed);

  const decision = await evaluateGateAccessByMemberId({
    // deno-lint-ignore no-explicit-any
    svc: svc as any,
    deviceId: 'reader-1',
    memberId: MEMBER_ID,
  });

  assertEquals(decision.granted, true);
  assertEquals(decision.reasonCode, 'granted');
  assertEquals(seed.check_ins.length, 1);
});

Deno.test('MemberId path grants without any token consumption', async () => {
  stubArrivalOk();
  const seed = baseSeed();
  const svc = makeFakeSvc(seed);

  const decision = await evaluateGateAccessByMemberId({
    // deno-lint-ignore no-explicit-any
    svc: svc as any,
    deviceId: 'reader-1',
    memberId: MEMBER_ID,
  });

  assertEquals(decision.granted, true);
  assertEquals(decision.reasonCode, 'granted');
  assertEquals(decision.tokenJti, null);
  assertEquals(seed.check_ins.length, 1);
});
