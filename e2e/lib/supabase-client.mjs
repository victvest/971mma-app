import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { loadE2EEnv, appRoot } from './env.mjs';

export function createE2ESupabase(env = loadE2EEnv()) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are required.');
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createServiceSupabase(env = loadE2EEnv()) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY required for service-role operations.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function signInPersona(supabase, email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Sign-in failed for ${email}: ${error?.message ?? 'no session'}`);
  }
  return {
    token: data.session.access_token,
    userId: data.user.id,
    email: data.user.email,
  };
}

export async function invokeEdge(env, name, token, body) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const res = await fetch(`${url}/functions/v1/${name}`, {
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

export function runSql(sql, env = loadE2EEnv()) {
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
