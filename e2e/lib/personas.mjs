import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { e2eRoot, loadE2EEnv } from './env.mjs';

function interpolate(template, env) {
  if (typeof template !== 'string') return template;
  return template.replace(/\$\{([A-Z0-9_]+)\}/g, (_, key) => env[key] ?? '');
}

export function resolvePersonas(env = loadE2EEnv()) {
  const rawPath = resolve(e2eRoot, 'config/personas.json');
  const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
  const resolved = {};

  for (const [key, persona] of Object.entries(raw)) {
    if (key.startsWith('$')) continue;
    resolved[key] = {
      ...persona,
      email: interpolate(persona.email, env),
      password: interpolate(persona.password, env),
      childProfileId: persona.childProfileId
        ? interpolate(persona.childProfileId, env)
        : undefined,
    };
  }

  return resolved;
}

export function writeResolvedPersonas(env = loadE2EEnv()) {
  const resolved = resolvePersonas(env);
  const outPath = resolve(e2eRoot, 'config/personas.resolved.json');
  writeFileSync(outPath, JSON.stringify(resolved, null, 2));
  return { resolved, outPath };
}

export function getPersona(key, env = loadE2EEnv()) {
  const personas = resolvePersonas(env);
  const persona = personas[key];
  if (!persona) throw new Error(`Unknown persona: ${key}`);
  return persona;
}

export function isPersonaConfigured(persona) {
  return Boolean(persona.email && persona.password && !persona.email.includes('${'));
}
