import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1';
import { mbFetch, mbPaginate } from './mindbody.ts';

type Row = Record<string, unknown>;

/** In-memory REST boundary; no test calls the live gym or Mindbody. */
class FakeDb {
  tables: Record<string, Row[]> = {
    mb_tokens: [{ id: 1, access_token: 'original-token', expires_at: '2999-01-01T00:00:00Z' }],
    mb_cache: [], classes: [], coaches: [], programs: [],
  };
  quota = 0;
  failClassUpdate = false;
  operations: string[] = [];
  client = this as unknown as SupabaseClient;

  rpc() { return Promise.resolve({ data: ++this.quota, error: null }); }
  from(table: string) {
    let op = 'select';
    let payload: Row | Row[] = {};
    const filters: Array<(row: Row) => boolean> = [];
    const db = this;
    const execute = () => {
      db.operations.push(`${table}:${op}`);
      const rows = db.tables[table] ?? [];
      if (op === 'upsert') {
        for (const row of Array.isArray(payload) ? payload : [payload]) {
          const key = table === 'mb_cache' ? 'cache_key' : table === 'classes' ? 'mindbody_class_id' : 'id';
          const existing = rows.find((item) => item[key] === row[key]);
          if (existing) Object.assign(existing, row);
          else rows.push({ id: `row-${rows.length}`, ...row });
        }
        db.tables[table] = rows;
        return { data: null, error: null };
      }
      const selected = rows.filter((row) => filters.every((filter) => filter(row)));
      if (op === 'update') {
        if (table === 'classes' && db.failClassUpdate) {
          return { data: null, error: { message: 'test mirror write failed' } };
        }
        selected.forEach((row) => Object.assign(row, payload));
      }
      return { data: selected, error: null };
    };
    const query = {
      select(..._args: unknown[]) { return query; },
      eq(key: string, value: unknown) { filters.push((row) => row[key] === value); return query; },
      is(key: string, value: unknown) { filters.push((row) => (row[key] ?? null) === value); return query; },
      not(key: string, _operator: string, value: unknown) { filters.push((row) => row[key] !== value); return query; },
      gt(key: string, value: string) { filters.push((row) => String(row[key]) > value); return query; },
      gte(key: string, value: string) { filters.push((row) => String(row[key]) >= value); return query; },
      lte(key: string, value: string) { filters.push((row) => String(row[key]) <= value); return query; },
      in(key: string, values: unknown[]) { filters.push((row) => values.includes(row[key])); return query; },
      upsert(value: Row | Row[], ..._args: unknown[]) { op = 'upsert'; payload = value; return query; },
      update(value: Row) { op = 'update'; payload = value; return query; },
      maybeSingle() { const result = execute(); return Promise.resolve({ ...result, data: result.data?.[0] ?? null }); },
      then(resolve: (value: ReturnType<typeof execute>) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve(execute()).then(resolve, reject);
      },
    };
    return query;
  }
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const range = { startDate: '2026-09-04', endDate: '2026-09-04' };
const sampleClass = {
  Id: 42, StartDateTime: '2026-09-04T18:00:00', EndDateTime: '2026-09-04T19:00:00',
  MaxCapacity: 20, TotalBooked: 7, IsAvailable: true, IsCanceled: false,
  ClassDescription: { Name: 'BJJ', Level: 'All Levels', Program: { Id: 1 }, SessionType: { Name: 'BJJ' } },
  Staff: { Id: 2, Name: 'Test Coach' },
};

Deno.test('Mindbody cost optimizations preserve live reads and schedule results', async (t) => {
  const savedFetch = globalThis.fetch;
  const savedInfo = console.info;
  const savedServe = Deno.serve;
  const config = {
    MINDBODY_BASE_URL: 'https://mindbody.test/public/v6',
    MINDBODY_API_KEY: 'private-api-key', MINDBODY_SITE_ID: '-99',
    MINDBODY_SOURCE_NAME: 'test', MINDBODY_SOURCE_PASSWORD: 'private-password',
  };
  const savedEnv = Object.fromEntries(Object.keys(config).map((key) => [key, Deno.env.get(key)]));
  Object.entries(config).forEach(([key, value]) => Deno.env.set(key, value));
  const logs: string[] = [];
  console.info = (line: string) => { logs.push(line); };
  // Import the production handler without opening an HTTP server.
  Deno.serve = (() => ({})) as unknown as typeof Deno.serve;
  try {
    const { syncSchedule } = await import('../mb-schedule/index.ts');
    Deno.serve = savedServe;

    await t.step('401 then 429 reuses the refreshed token, with one quota count per actual call', async () => {
      const db = new FakeDb();
      const statuses = [401, 429, 200];
      let issued = 0;
      const authorizations: Array<string | null> = [];
      globalThis.fetch = ((input, init) => {
        if (String(input).includes('/usertoken/issue')) {
          issued++;
          return Promise.resolve(json({ AccessToken: 'fresh-token', Expires: '2999-01-01T00:00:00Z' }));
        }
        authorizations.push(new Headers(init?.headers).get('Authorization'));
        return Promise.resolve(json({ value: 'current' }, statuses.shift()));
      }) as typeof fetch;
      const result = await mbFetch(db.client, '/client/clientcontracts?request.clientId=private-member');
      assertEquals(result, { value: 'current' });
      assertEquals(issued, 1);
      assertEquals(db.quota, 4);
      assertEquals(authorizations, ['Bearer original-token', 'Bearer fresh-token', 'Bearer fresh-token']);
    });

    await t.step('read-only key fallback still works after a refreshed token is rejected', async () => {
      const db = new FakeDb();
      let issued = 0;
      globalThis.fetch = ((input, init) => {
        if (String(input).includes('/usertoken/issue')) {
          issued++;
          return Promise.resolve(json({ AccessToken: 'fresh-token', Expires: '2999-01-01T00:00:00Z' }));
        }
        return Promise.resolve(new Headers(init?.headers).has('Authorization')
          ? json({}, 401) : json({ current: true }));
      }) as typeof fetch;
      assertEquals(await mbFetch(db.client, '/client/clientcontracts'), { current: true });
      assertEquals(issued, 1);
      assertEquals(db.quota, 4);
    });

    await t.step('arrival writes never use API-key-only fallback or get deduplicated', async () => {
      const db = new FakeDb();
      let arrivals = 0;
      globalThis.fetch = ((input, init) => {
        if (String(input).includes('/usertoken/issue')) {
          return Promise.resolve(json({ AccessToken: 'fresh-token', Expires: '2999-01-01T00:00:00Z' }));
        }
        assert(new Headers(init?.headers).has('Authorization'));
        arrivals++;
        return Promise.resolve(json({}, 401));
      }) as typeof fetch;
      await assertRejects(() => mbFetch(db.client, '/client/addarrival', { method: 'POST' }));
      assertEquals(arrivals, 2);
      globalThis.fetch = (() => { arrivals++; return Promise.resolve(json({ Visit: { Id: arrivals } })); }) as typeof fetch;
      await Promise.all([
        mbFetch(db.client, '/client/addarrival', { method: 'POST', body: '{}' }),
        mbFetch(db.client, '/client/addarrival', { method: 'POST', body: '{}' }),
      ]);
      assertEquals(arrivals, 4);
    });

    await t.step('sequential membership reads always hit Mindbody and see changed data', async () => {
      const db = new FakeDb();
      let current = true;
      globalThis.fetch = (() => Promise.resolve(json({ Current: current }))) as typeof fetch;
      assertEquals(await mbFetch(db.client, '/client/activeclientmemberships'), { Current: true });
      current = false;
      assertEquals(await mbFetch(db.client, '/client/activeclientmemberships'), { Current: false });
      assertEquals(db.quota, 2);
    });

    await t.step('usage logs omit member IDs, keys, tokens, payloads, and passwords', async () => {
      const db = new FakeDb();
      globalThis.fetch = (() => Promise.reject(new Error('network failed'))) as typeof fetch;
      await assertRejects(() => mbFetch(db.client, '/client/clients?request.clientId=private-member'));
      const combined = logs.join('\n');
      for (const secret of ['private-member', 'private-api-key', 'private-password', 'fresh-token', 'original-token']) {
        assert(!combined.includes(secret));
      }
      const last = JSON.parse(logs.at(-1)!);
      assertEquals(last.event, 'mindbody_request');
      assertEquals(last.endpoint, '/client/clients');
      assertEquals(last.status, null);
      assert(logs.some((line) => JSON.parse(line).status === 429));
    });

    await t.step('pagination still reads every page without losing records', async () => {
      const db = new FakeDb();
      const offsets: number[] = [];
      globalThis.fetch = ((input) => {
        const offset = Number(new URL(String(input)).searchParams.get('request.offset'));
        offsets.push(offset);
        return Promise.resolve(json({ PaginationResponse: { TotalResults: 205 },
          items: Array.from({ length: Math.min(100, 205 - offset) }, (_, i) => offset + i) }));
      }) as typeof fetch;
      const result = await mbPaginate<number, { PaginationResponse: { TotalResults: number }; items: number[] }>(
        db.client, '/client/clientvisits', {}, (page) => page.items,
      );
      assertEquals(offsets, [0, 100, 200]);
      assertEquals(result, Array.from({ length: 205 }, (_, i) => i));
    });

    await t.step('25 concurrent ordinary schedule requests share one live fetch and complete mirror', async () => {
      const db = new FakeDb();
      db.tables.coaches = [{ id: 'coach-2', name: 'Test Coach', mindbody_staff_id: '2', active: true }];
      db.tables.programs = [{ id: 'program-1', mindbody_program_id: '1', discipline_id: 'bjj' }];
      const started = deferred();
      const release = deferred();
      let calls = 0;
      globalThis.fetch = (async () => { calls++; started.resolve(); await release.promise; return json({ Classes: [sampleClass] }); }) as typeof fetch;
      const requests = Array.from({ length: 25 }, () => syncSchedule(db.client, range));
      await started.promise;
      release.resolve();
      const results = await Promise.all(requests);
      assertEquals(calls, 1);
      results.forEach((result) => assertEquals(result, { refreshed: true, count: 1, mindbodyFetched: 1, tombstoned: 0 }));
      assertEquals(db.tables.classes[0].booked_count, 7);
      assertEquals(db.tables.classes[0].capacity, 20);
      assertEquals(db.tables.classes[0].coach_id, 'coach-2');
      assertEquals(db.tables.classes[0].program_id, 'program-1');
      assertEquals(db.tables.classes[0].starts_at, '2026-09-04T14:00:00.000Z');
      assertEquals(await syncSchedule(db.client, range), { refreshed: false, count: 0 });
      assertEquals(calls, 1);
      db.tables.mb_cache[0].expires_at = '2000-01-01T00:00:00Z';
      await syncSchedule(db.client, range);
      assertEquals(calls, 2);
    });

    await t.step('forced refreshes bypass sharing even while an ordinary refresh is running', async () => {
      const db = new FakeDb();
      const started = deferred();
      const release = deferred();
      let calls = 0;
      globalThis.fetch = (async () => { calls++; started.resolve(); await release.promise; return json({ Classes: [] }); }) as typeof fetch;
      const ordinary = syncSchedule(db.client, range);
      await started.promise;
      const forced = [syncSchedule(db.client, { ...range, force: true }), syncSchedule(db.client, { ...range, force: true })];
      release.resolve();
      await Promise.all([ordinary, ...forced]);
      assertEquals(calls, 3);
    });

    await t.step('different date ranges do not share and empty responses gain no new cache window', async () => {
      const db = new FakeDb();
      let calls = 0;
      globalThis.fetch = (() => { calls++; return Promise.resolve(json({ Classes: [] })); }) as typeof fetch;
      await Promise.all([syncSchedule(db.client, range), syncSchedule(db.client, { startDate: '2026-09-05', endDate: '2026-09-05' })]);
      assertEquals(calls, 2);
      await syncSchedule(db.client, range);
      assertEquals(calls, 3);
      assertEquals(db.tables.mb_cache, []);
    });

    await t.step('failed shared refreshes reject every caller and the next request retries live', async () => {
      const db = new FakeDb();
      let calls = 0;
      globalThis.fetch = (() => { calls++; return Promise.resolve(json({}, 500)); }) as typeof fetch;
      const results = await Promise.allSettled(Array.from({ length: 10 }, () => syncSchedule(db.client, range)));
      assertEquals(calls, 1);
      assert(results.every((result) => result.status === 'rejected'));
      globalThis.fetch = (() => { calls++; return Promise.resolve(json({ Classes: [sampleClass] })); }) as typeof fetch;
      await syncSchedule(db.client, range);
      assertEquals(calls, 2);
    });

    await t.step('failed cancellation writes never publish a success cache marker', async () => {
      const db = new FakeDb();
      db.tables.classes = [{ id: 'removed', mindbody_class_id: '99', is_cancelled: false, starts_at: '2026-09-04T14:00:00.000Z' }];
      db.failClassUpdate = true;
      globalThis.fetch = (() => Promise.resolve(json({ Classes: [sampleClass] }))) as typeof fetch;
      await assertRejects(() => syncSchedule(db.client, range), Error, 'test mirror write failed');
      assertEquals(db.tables.mb_cache, []);
      db.failClassUpdate = false;
      await syncSchedule(db.client, range);
      assertEquals(db.tables.classes.find((row) => row.id === 'removed')?.is_cancelled, true);
      assertEquals(db.tables.mb_cache.length, 1);
      assert(db.operations.lastIndexOf('classes:update') < db.operations.lastIndexOf('mb_cache:upsert'));
    });
  } finally {
    globalThis.fetch = savedFetch;
    console.info = savedInfo;
    Deno.serve = savedServe;
    Object.entries(savedEnv).forEach(([key, value]) => value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value));
  }
});
