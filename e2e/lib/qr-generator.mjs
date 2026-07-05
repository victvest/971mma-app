import { createHmac, randomUUID } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { invokeEdge, signInPersona, createE2ESupabase } from './supabase-client.mjs';
import { loadE2EEnv, outputRoot } from './env.mjs';
import { getPersona } from './personas.mjs';

function toBase64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function signGateToken(payload, secret) {
  const header = toBase64Url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = toBase64Url(Buffer.from(JSON.stringify(payload)));
  const sig = toBase64Url(createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

export async function issueMemberQrPass(env, personaKey = 'member') {
  const supabase = createE2ESupabase(env);
  const persona = getPersona(personaKey, env);
  if (!persona.email || !persona.password) {
    throw new Error(`Persona "${personaKey}" missing email/password in e2e/config/personas.json`);
  }
  const session = await signInPersona(supabase, persona.email, persona.password);
  const result = await invokeEdge(env, 'qr-issue', session.token, {});
  if (!result.ok) {
    throw new Error(`qr-issue failed: ${JSON.stringify(result.body)}`);
  }
  return { ...result.body, userId: session.userId, token: session.token };
}

export async function issueGateQr(env, personaKey = 'gate') {
  const supabase = createE2ESupabase(env);
  const persona = getPersona(personaKey, env);
  if (!persona.email || !persona.password) {
    throw new Error(`Persona "${personaKey}" missing email/password`);
  }
  const session = await signInPersona(supabase, persona.email, persona.password);
  const result = await invokeEdge(env, 'gate-qr-issue', session.token, {});
  if (!result.ok) {
    throw new Error(`gate-qr-issue failed: ${JSON.stringify(result.body)}`);
  }
  return { ...result.body, gateUserId: session.userId };
}

export async function generateQrFixtures() {
  const env = loadE2EEnv();
  const fixtureDir = resolve(outputRoot, 'fixtures');
  mkdirSync(fixtureDir, { recursive: true });

  const fixtures = { generatedAt: new Date().toISOString(), memberPass: null, gateEntrance: null };

  try {
    const pass = await issueMemberQrPass(env, 'member');
    fixtures.memberPass = { issued: true, expiresAt: pass.expiresAt, userId: pass.userId };
    writeFileSync(resolve(fixtureDir, 'member-qr-pass.json'), JSON.stringify(fixtures.memberPass, null, 2));
  } catch (error) {
    fixtures.memberPass = { error: error.message };
  }

  try {
    const gate = await issueGateQr(env, 'gate');
    fixtures.gateEntrance = { issued: true, expiresAt: gate.expiresAt };
    writeFileSync(resolve(fixtureDir, 'gate-qr-entrance.json'), JSON.stringify(fixtures.gateEntrance, null, 2));
  } catch (error) {
    fixtures.gateEntrance = { error: error.message };
  }

  writeFileSync(resolve(fixtureDir, 'qr-fixtures.json'), JSON.stringify(fixtures, null, 2));
  return fixtures;
}
