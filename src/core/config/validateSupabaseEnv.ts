

const SUPABASE_URL_PATTERN = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i;

export type SupabaseEnvValidation =
  | { ok: true; url: string; anonKey: string }
  | { ok: false; error: string };

function decodeJwtPayload(key: string): Record<string, unknown> | null {
  try {
    const parts = key.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function validateSupabaseEnv(url: string, anonKey: string): SupabaseEnvValidation {
  const trimmedUrl = url.trim().replace(/\/$/, '');
  const trimmedKey = anonKey.trim();

  if (!trimmedUrl || !trimmedKey) {
    return {
      ok: false,
      error:
        'Supabase is not configured. Copy .env.example to .env and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    };
  }

  if (!SUPABASE_URL_PATTERN.test(trimmedUrl)) {
    return {
      ok: false,
      error: 'EXPO_PUBLIC_SUPABASE_URL must be https://<project-ref>.supabase.co',
    };
  }

  const payload = decodeJwtPayload(trimmedKey);
  if (!payload) {
    return { ok: false, error: 'EXPO_PUBLIC_SUPABASE_ANON_KEY is not a valid JWT.' };
  }

  const role = payload.role;
  if (role === 'service_role') {
    return {
      ok: false,
      error:
        'SECURITY: service_role key detected. Never use the service_role key in the mobile app — use the anon key from Supabase Dashboard → Settings → API.',
    };
  }

  if (role !== 'anon') {
    return {
      ok: false,
      error: `Unexpected Supabase key role "${String(role)}". Use the anon (public) key only.`,
    };
  }

  const ref = payload.ref;
  const urlRef = trimmedUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1];
  if (ref && urlRef && String(ref) !== urlRef) {
    return {
      ok: false,
      error: 'Supabase URL project ref does not match the anon key project ref.',
    };
  }

  return { ok: true, url: trimmedUrl, anonKey: trimmedKey };
}
