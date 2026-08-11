import { createE2ESupabase, signInPersona, invokeEdge, runSql } from './supabase-client.mjs';
import { getPersona, isPersonaConfigured } from './personas.mjs';
import { loadE2EEnv } from './env.mjs';

export const WORKFLOW_ASSERTIONS = {
  async 'auth.member-profile'(env) {
    const persona = getPersona('member', env);
    if (!isPersonaConfigured(persona)) return { skip: true, reason: 'Member persona not configured' };
    const supabase = createE2ESupabase(env);
    const session = await signInPersona(supabase, persona.email, persona.password);
    const rows = runSql(
      `select id, role, account_status, full_name from public.profiles where id = '${session.userId}' limit 1;`,
      env,
    );
    const profile = rows[0];
    if (!profile) throw new Error('Profile row missing after sign-in');
    if (profile.role !== 'member' && profile.role !== 'coach') {
      throw new Error(`Unexpected role: ${profile.role}`);
    }
    return { userId: session.userId, profile };
  },

  async 'auth.invalid-credentials'(env) {
    const persona = getPersona('invalid', env);
    const supabase = createE2ESupabase(env);
    const { error } = await supabase.auth.signInWithPassword({
      email: persona.email,
      password: persona.password,
    });
    if (!error) throw new Error('Expected sign-in to fail for invalid credentials');
    return { error: error.message };
  },

  async 'checkin.member-qr-issue'(env) {
    const persona = getPersona('member', env);
    if (!isPersonaConfigured(persona)) return { skip: true, reason: 'Member persona not configured' };
    const supabase = createE2ESupabase(env);
    const session = await signInPersona(supabase, persona.email, persona.password);
    const result = await invokeEdge(env, 'qr-issue', session.token, {});
    if (!result.ok) throw new Error(`qr-issue failed: ${JSON.stringify(result.body)}`);
    if (!result.body?.token && !result.body?.qrToken) {
      throw new Error('qr-issue response missing token');
    }
    const tokens = runSql(
      `select count(*)::int as count from public.qr_tokens where user_id = '${session.userId}' and expires_at > now();`,
      env,
    );
    return { tokenIssued: true, activeTokens: tokens[0]?.count ?? 0 };
  },

  async 'membership.sync'(env) {
    const persona = getPersona('member', env);
    if (!isPersonaConfigured(persona)) return { skip: true, reason: 'Member persona not configured' };
    const supabase = createE2ESupabase(env);
    const session = await signInPersona(supabase, persona.email, persona.password);
    const result = await invokeEdge(env, 'mb-membership', session.token, {});
    const memberships = runSql(
      `select count(*)::int as count from public.member_memberships where user_id = '${session.userId}';`,
      env,
    );
    return { edgeOk: result.ok, membershipRows: memberships[0]?.count ?? 0, edgeStatus: result.status };
  },

  async 'schedule.programs'(env) {
    const persona = getPersona('member', env);
    if (!isPersonaConfigured(persona)) return { skip: true, reason: 'Member persona not configured' };
    const supabase = createE2ESupabase(env);
    const session = await signInPersona(supabase, persona.email, persona.password);
    const result = await invokeEdge(env, 'mb-programs', session.token, {});
    const classes = runSql(
      `select count(*)::int as count from public.classes where starts_at > now() - interval '1 day';`,
      env,
    );
    return { edgeOk: result.ok, upcomingClasses: classes[0]?.count ?? 0 };
  },

  async 'mindbody.link'(env) {
    const persona = getPersona('member', env);
    if (!isPersonaConfigured(persona)) return { skip: true, reason: 'Member persona not configured' };
    const supabase = createE2ESupabase(env);
    const session = await signInPersona(supabase, persona.email, persona.password);
    const links = runSql(
      `select mindbody_client_id, link_method, linked_at from public.mindbody_links where user_id = '${session.userId}' limit 1;`,
      env,
    );
    if (!links[0]) return { skip: true, reason: 'No Mindbody link for test member' };
    return { link: links[0] };
  },

  async 'rewards.points-account'(env) {
    const persona = getPersona('member', env);
    if (!isPersonaConfigured(persona)) return { skip: true, reason: 'Member persona not configured' };
    const supabase = createE2ESupabase(env);
    const session = await signInPersona(supabase, persona.email, persona.password);
    const accounts = runSql(
      `select balance from public.points_balance_cache where user_id = '${session.userId}' limit 1;`,
      env,
    );
    return { hasPointsAccount: accounts.length > 0, balance: accounts[0]?.balance ?? 0 };
  },

  async 'attendance.history'(env) {
    const persona = getPersona('member', env);
    if (!isPersonaConfigured(persona)) return { skip: true, reason: 'Member persona not configured' };
    const supabase = createE2ESupabase(env);
    const session = await signInPersona(supabase, persona.email, persona.password);
    const checkIns = runSql(
      `select count(*)::int as count from public.check_ins where user_id = '${session.userId}';`,
      env,
    );
    return { checkInCount: checkIns[0]?.count ?? 0 };
  },

  async 'communities.channels'(env) {
    const persona = getPersona('member', env);
    if (!isPersonaConfigured(persona)) return { skip: true, reason: 'Member persona not configured' };
    const supabase = createE2ESupabase(env);
    const session = await signInPersona(supabase, persona.email, persona.password);
    const channels = runSql(`select count(*)::int as count from public.community_channels;`, env);
    const memberships = runSql(
      `select count(*)::int as count from public.community_memberships where user_id = '${session.userId}';`,
      env,
    );
    return { channelCount: channels[0]?.count ?? 0, userMemberships: memberships[0]?.count ?? 0 };
  },

  async 'guardian.links'(env) {
    const persona = getPersona('guardian', env);
    if (!isPersonaConfigured(persona)) {
      return { skip: true, reason: 'Guardian persona not configured' };
    }
    const supabase = createE2ESupabase(env);
    const session = await signInPersona(supabase, persona.email, persona.password);
    const links = runSql(
      `select count(*)::int as count from public.guardian_links where guardian_id = '${session.userId}' and status = 'approved';`,
      env,
    );
    return { approvedLinks: links[0]?.count ?? 0 };
  },
};

export async function runDbAssertion(workflowId, env = loadE2EEnv()) {
  const fn = WORKFLOW_ASSERTIONS[workflowId];
  if (!fn) throw new Error(`No DB assertion for workflow: ${workflowId}`);
  const started = Date.now();
  try {
    const result = await fn(env);
    if (result?.skip) {
      return { status: 'SKIP', details: result.reason, durationMs: Date.now() - started, data: result };
    }
    return { status: 'PASS', durationMs: Date.now() - started, data: result };
  } catch (error) {
    return {
      status: 'FAIL',
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
