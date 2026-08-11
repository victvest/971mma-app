import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const appRoot = resolve(__dirname, '../..');
export const e2eRoot = resolve(__dirname, '..');
export const outputRoot = resolve(e2eRoot, 'output');

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].trim().replace(/^"|"$/g, '');
  }
  return env;
}

export function loadE2EEnv() {
  const personasPath = resolve(e2eRoot, 'config/personas.json');
  const personas = existsSync(personasPath)
    ? JSON.parse(readFileSync(personasPath, 'utf8'))
    : {};

  // Single source of truth: 971mma-app/.env
  // supabase/.env.local is a symlink to the same file (kept for CLI compatibility).
  return {
    ...parseEnvFile(resolve(appRoot, '.env')),
    ...parseEnvFile(resolve(appRoot, 'supabase/.env.local')),
    ...parseEnvFile(resolve(e2eRoot, 'config/.env.local')),
    ...process.env,
    personas,
  };
}

export function requireEnv(env, keys) {
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Missing required env: ${missing.join(', ')}`);
  }
}
