import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';

type SignInBody = {
  email?: string;
  password?: string;
};

type AuthSignInErrorCode =
  | 'BAD_REQUEST'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_CONFIRMED'
  | 'ACCOUNT_DISABLED';

const INVALID_CREDENTIALS_MESSAGE = 'Email or password is incorrect.';
const MIN_RESPONSE_MS = 300;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function authError(code: AuthSignInErrorCode, message: string, status: number): Response {
  return jsonResponse({ error: { code, message } }, { status });
}

async function ensureMinResponseDelay(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_RESPONSE_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_RESPONSE_MS - elapsed));
  }
}

async function rejectInvalidCredentials(startedAt: number): Promise<Response> {
  await ensureMinResponseDelay(startedAt);
  return authError('INVALID_CREDENTIALS', INVALID_CREDENTIALS_MESSAGE, 401);
}

async function lookupUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await serviceClient().rpc('get_auth_user_id_by_email', {
    p_email: email,
  });

  if (error) throw error;
  return typeof data === 'string' ? data : null;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return authError('BAD_REQUEST', 'Method not allowed.', 405);
  }

  const startedAt = Date.now();

  try {
    const body = (await req.json()) as SignInBody;
    const email = normalizeEmail(body.email ?? '');
    const password = body.password ?? '';

    if (!email) {
      return authError('BAD_REQUEST', 'Enter your email address.', 400);
    }
    if (!password) {
      return authError('BAD_REQUEST', 'Enter your password.', 400);
    }

    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !anonKey) {
      throw new Error('Missing Supabase env.');
    }

    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const userId = await lookupUserIdByEmail(email);
    if (!userId) {
      await anon.auth.signInWithPassword({ email, password });
      return await rejectInvalidCredentials(startedAt);
    }

    const { data: userData, error: userError } = await serviceClient().auth.admin.getUserById(userId);
    if (userError) throw userError;

    const user = userData.user;
    if (!user) {
      await anon.auth.signInWithPassword({ email, password });
      return await rejectInvalidCredentials(startedAt);
    }

    const { data: profile } = await serviceClient()
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();



    if (!user.email_confirmed_at) {
      await ensureMinResponseDelay(startedAt);
      return authError(
        'EMAIL_NOT_CONFIRMED',
        'Confirm your email before signing in. Check your inbox for the verification code.',
        403,
      );
    }

    if (user.banned_until) {
      const bannedUntil = new Date(user.banned_until);
      if (!Number.isNaN(bannedUntil.getTime()) && bannedUntil > new Date()) {
        await ensureMinResponseDelay(startedAt);
        return authError(
          'ACCOUNT_DISABLED',
          'This account has been disabled. Contact support for help.',
          403,
        );
      }
    }

    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return await rejectInvalidCredentials(startedAt);
    }

    return jsonResponse({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch {
    return jsonResponse(
      { error: { code: 'UPSTREAM_ERROR', message: 'Unable to sign in right now. Try again.' } },
      { status: 500 },
    );
  }
});
