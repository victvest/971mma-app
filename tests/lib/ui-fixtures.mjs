#!/usr/bin/env node
/**
 * Create stable UI-login-capable accounts (member/coach/gate) for Maestro device
 * flows, since the shared TEST_USER is an admin and is provably blocked from
 * mobile sign-in (see tests/mobile-app/auth/auth.test.mjs).
 *
 * Usage:
 *   node tests/lib/ui-fixtures.mjs create   # prints env exports
 *   node tests/lib/ui-fixtures.mjs cleanup  # deletes ephemeral accounts only
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHarness, ensureUiTestUser, deleteEphemeralUser } from './harness.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = resolve(__dirname, '.ui-fixtures.json');
const EPHEMERAL_DOMAIN = '971mma-e2e.test';
const UI_PASSWORD = 'Bahaa0541@';

const UI_ACCOUNTS = {
  member: { email: 'mlbegueroumi+10@gmail.com', fullName: 'UI Test Member', role: 'member' },
  coach: { email: 'mlbegueroumi+11@gmail.com', fullName: 'UI Test Coach', role: 'coach' },
  gate: { email: 'mlbegueroumi+12@gmail.com', fullName: 'UI Test Gate', role: 'gate' },
};

async function create() {
  const h = createHarness();

  const member = await ensureUiTestUser(h, { ...UI_ACCOUNTS.member, password: UI_PASSWORD });
  const coach = await ensureUiTestUser(h, { ...UI_ACCOUNTS.coach, password: UI_PASSWORD });
  const gate = await ensureUiTestUser(h, { ...UI_ACCOUNTS.gate, password: UI_PASSWORD });

  const state = { member, coach, gate };
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  console.log('# UI fixtures ready — source these into your shell:');
  console.log(`export MEMBER_EMAIL='${member.email}'`);
  console.log(`export MEMBER_PASSWORD='${member.password}'`);
  console.log(`export COACH_EMAIL='${coach.email}'`);
  console.log(`export COACH_PASSWORD='${coach.password}'`);
  console.log(`export GATE_EMAIL='${gate.email}'`);
  console.log(`export GATE_PASSWORD='${gate.password}'`);
}

async function cleanup() {
  if (!existsSync(STATE_PATH)) {
    console.log('No .ui-fixtures.json — nothing to clean up.');
    return;
  }
  const state = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  const h = createHarness();
  for (const key of ['member', 'coach', 'gate']) {
    const entry = state[key];
    if (!entry?.userId) continue;
    if (entry.email?.endsWith(`@${EPHEMERAL_DOMAIN}`)) {
      await deleteEphemeralUser(h, entry.userId);
      console.log(`deleted ${key}: ${entry.email}`);
    } else {
      console.log(`skipped fixed account ${key}: ${entry.email}`);
    }
  }
}

const cmd = process.argv[2];
if (cmd === 'create') await create();
else if (cmd === 'cleanup') await cleanup();
else {
  console.error('Usage: node tests/lib/ui-fixtures.mjs <create|cleanup>');
  process.exit(1);
}
