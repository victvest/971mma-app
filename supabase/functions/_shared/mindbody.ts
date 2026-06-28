import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1';
import { MbError } from './errors.ts';
import { assertQuota, withConcurrencyLimit } from './rateLimit.ts';

type TokenRow = {
  access_token: string | null;
  token_type: string | null;
  expires_at: string | null;
};

type TokenIssueResponse = {
  AccessToken?: unknown;
  TokenType?: unknown;
  Expires?: unknown;
};

type PaginationResponse = {
  TotalResults?: unknown;
};

type PaginatedPage = {
  PaginationResponse?: PaginationResponse;
};

const TOKEN_REFRESH_SKEW_MS = 60_000;
const PAGE_SIZE = 100;
const MAX_RETRIES = 3;

let refreshPromise: Promise<string> | null = null;

function env(key: string): string {
  const value = Deno.env.get(key);
  if (!value) throw new MbError('UPSTREAM_ERROR', `Missing server env: ${key}`, 500);
  return value;
}

function baseUrl(): string {
  return env('MINDBODY_BASE_URL').replace(/\/+$/, '');
}

function baseHeaders(): Headers {
  const headers = new Headers();
  headers.set('Api-Key', env('MINDBODY_API_KEY'));
  headers.set('SiteId', env('MINDBODY_SITE_ID'));
  headers.set('Content-Type', 'application/json');
  return headers;
}

function isSandbox(): boolean {
  return Deno.env.get('MINDBODY_SITE_ID') === '-99';
}

function isReadMethod(method?: string): boolean {
  return (method ?? 'GET').toUpperCase() === 'GET';
}

function isUsableToken(row: TokenRow | null): row is Required<TokenRow> {
  if (!row?.access_token || !row.expires_at) return false;
  return new Date(row.expires_at).getTime() > Date.now() + TOKEN_REFRESH_SKEW_MS;
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function mindbodyErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const nested = record.Error;
    if (nested && typeof nested === 'object') {
      const error = nested as Record<string, unknown>;
      const message = typeof error.Message === 'string' ? error.Message : null;
      const code = typeof error.Code === 'string' ? error.Code : null;
      if (message && code) return `${message} (${code})`;
      if (message) return message;
    }

    if (typeof record.Message === 'string') return record.Message;
  }

  return `Mindbody request failed (HTTP ${status}).`;
}

async function issueToken(svc: SupabaseClient): Promise<string> {
  await assertQuota(svc);

  const res = await withConcurrencyLimit(() =>
    fetch(`${baseUrl()}/usertoken/issue`, {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({
        Username: env('MINDBODY_SOURCE_NAME'),
        Password: env('MINDBODY_SOURCE_PASSWORD'),
      }),
    }),
  );

  const body = (await parseJson(res)) as TokenIssueResponse | null;
  const token = typeof body?.AccessToken === 'string' ? body.AccessToken : null;
  const tokenType = typeof body?.TokenType === 'string' ? body.TokenType : 'Bearer';
  const expires = typeof body?.Expires === 'string' ? body.Expires : null;

  if (!res.ok || !token || !expires) {
    throw new MbError(
      'UPSTREAM_ERROR',
      `Unable to issue Mindbody user token: ${mindbodyErrorMessage(body, res.status)}`,
    );
  }

  const expiresAt = new Date(new Date(expires).getTime() - TOKEN_REFRESH_SKEW_MS).toISOString();
  const { error } = await svc.from('mb_tokens').upsert({
    id: 1,
    access_token: token,
    token_type: tokenType,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new MbError('UPSTREAM_ERROR', 'Unable to cache Mindbody user token.');
  }

  return token;
}

export async function getToken(svc: SupabaseClient, forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const { data, error } = await svc
      .from('mb_tokens')
      .select('access_token, token_type, expires_at')
      .eq('id', 1)
      .maybeSingle<TokenRow>();

    if (error) {
      throw new MbError('UPSTREAM_ERROR', 'Unable to read Mindbody token cache.');
    }

    if (isUsableToken(data)) return data.access_token;
  }

  if (!refreshPromise) {
    refreshPromise = issueToken(svc).finally(() => {
      refreshPromise = null;
    });
  }

  return await refreshPromise;
}

function buildUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(retryAfter: string | null, attempt: number): number {
  const seconds = retryAfter ? Number.parseInt(retryAfter, 10) : 0;
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return Math.min(250 * 2 ** attempt, 2_000);
}

async function fetchMindbody<T>(
  path: string,
  init: RequestInit,
  token: string | null,
): Promise<{ status: number; body: T; retryAfter: string | null }> {
  const headers = baseHeaders();
  const incoming = new Headers(init.headers);

  incoming.forEach((value, key) => headers.set(key, value));
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await withConcurrencyLimit(() =>
    fetch(buildUrl(path), {
      ...init,
      headers,
    }),
  );
  const body = (await parseJson(res)) as T;

  return { status: res.status, body, retryAfter: res.headers.get('Retry-After') };
}

export async function mbFetch<T>(
  svc: SupabaseClient,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const sandboxRead = isSandbox() && isReadMethod(init.method);
  let forceTokenRefresh = false;
  let useKeyOnly = false;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let token: string | null = null;

    if (!useKeyOnly) {
      try {
        token = await getToken(svc, forceTokenRefresh);
      } catch (error) {
        if (!sandboxRead) throw error;
        useKeyOnly = true;
      }
    }

    await assertQuota(svc);
    const { status, body, retryAfter } = await fetchMindbody<T>(
      path,
      init,
      useKeyOnly ? null : token,
    );

    if (status >= 200 && status < 300) return body;

    if (status === 401 && token && !useKeyOnly) {
      if (!forceTokenRefresh) {
        forceTokenRefresh = true;
        continue;
      }
      if (sandboxRead) {
        useKeyOnly = true;
        forceTokenRefresh = false;
        continue;
      }
    }

    if (status === 401 && sandboxRead && !useKeyOnly) {
      useKeyOnly = true;
      continue;
    }

    if (status === 429 && attempt < MAX_RETRIES) {
      await sleep(retryDelayMs(retryAfter, attempt));
      continue;
    }

    if (status === 429) {
      throw new MbError('RATE_LIMITED', 'Mindbody rate limit reached.');
    }

    throw new MbError('UPSTREAM_ERROR', mindbodyErrorMessage(body, status));
  }

  throw new MbError('UPSTREAM_ERROR', 'Mindbody request failed.');
}

export async function mbPaginate<TItem, TPage extends PaginatedPage>(
  svc: SupabaseClient,
  path: string,
  params: Record<string, string>,
  pick: (page: TPage) => TItem[],
): Promise<TItem[]> {
  const items: TItem[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const query = new URLSearchParams(params);
    query.set('request.limit', String(PAGE_SIZE));
    query.set('request.offset', String(offset));

    const page = await mbFetch<TPage>(svc, `${path}?${query.toString()}`);
    items.push(...pick(page));

    const totalResults = page.PaginationResponse?.TotalResults;
    total = typeof totalResults === 'number' ? totalResults : items.length;
    offset += PAGE_SIZE;

    if (items.length === 0 && total === 0) break;
  }

  return items;
}

export async function cacheGet<T>(svc: SupabaseClient, key: string): Promise<T | null> {
  const { data, error } = await svc
    .from('mb_cache')
    .select('payload, expires_at')
    .eq('cache_key', key)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle<{ payload: T; expires_at: string }>();

  if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to read Mindbody cache.');
  return data?.payload ?? null;
}

export async function cacheSet(
  svc: SupabaseClient,
  key: string,
  payload: unknown,
  ttlSec: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
  const { error } = await svc.from('mb_cache').upsert({
    cache_key: key,
    payload,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  });

  if (error) throw new MbError('UPSTREAM_ERROR', 'Unable to write Mindbody cache.');
}
