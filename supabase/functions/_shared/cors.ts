// Origin allow-list. The native mobile app sends no Origin header and does not
// enforce CORS, so restricting these values never affects it. Browser callers
// (the admin panel) must have their deployed origin in ALLOWED_ORIGINS.
const DEFAULT_ALLOWED_ORIGINS = [
  'https://app.971mma.com',
  'http://localhost:3000',
  'http://localhost:3001',
];

function allowedOrigins(): string[] {
  const fromEnv = Deno.env.get('ALLOWED_ORIGINS');
  const extra = fromEnv
    ? fromEnv.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
  return [...DEFAULT_ALLOWED_ORIGINS, ...extra];
}

function matchesAllowedOrigin(origin: string, allowed: string): boolean {
  if (origin === allowed) return true;

  if (!allowed.includes('*')) return false;

  try {
    const requestUrl = new URL(origin);
    const allowedUrl = new URL(allowed);
    if (requestUrl.protocol !== allowedUrl.protocol) return false;

    const allowedHost = allowedUrl.hostname;
    if (!allowedHost.startsWith('*.')) return false;

    const suffix = allowedHost.slice(1);
    return requestUrl.hostname.endsWith(suffix);
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins().some((allowed) => matchesAllowedOrigin(origin, allowed));
}

function resolveCorsOrigin(req?: Request): string {
  const origin = req?.headers.get('origin');
  if (origin && isAllowedOrigin(origin)) return origin;
  // Disallowed browser origins get a mismatch (blocked by the browser).
  // Native app / server-to-server callers ignore this header entirely.
  return allowedOrigins()[0];
}

export function corsHeaders(req?: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveCorsOrigin(req),
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  };
}

export function handleOptions(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export function jsonResponse(body: unknown, init: ResponseInit = {}, req?: Request): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

// Wraps a handler so every response reflects the request's (allow-listed) origin.
// Used by functions the admin panel calls from the browser, where the response
// must carry an Access-Control-Allow-Origin matching the admin's deployed origin.
export async function withCors(
  req: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const res = await handler();
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(corsHeaders(req))) {
    headers.set(key, value);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
