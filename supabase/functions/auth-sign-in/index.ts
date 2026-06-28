import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';

type SignInBody = {
  email?: string;
  password?: string;
};

type AuthSignInErrorCode =
  | 'BAD_REQUEST'
  | 'EMAIL_NOT_FOUND'
  | 'WRONG_PASSWORD'
  | 'EMAIL_NOT_CONFIRMED'
  | 'ACCOUNT_DISABLED';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function authError(code: AuthSignInErrorCode, message: string, status: number): Response {
  return jsonResponse({ error: { code, message } }, { status });
}

async function findUserByEmail(email: string) {
  const admin = serviceClient();

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) break;
  }

  return null;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return authError('BAD_REQUEST', 'Method not allowed.', 405);
  }

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

    const user = await findUserByEmail(email);
    if (!user) {
      return authError('EMAIL_NOT_FOUND', 'No account found for this email address.', 404);
    }

    // Check if user is admin
    const { data: profile } = await serviceClient()
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role === 'admin') {
      return authError('ACCOUNT_DISABLED', 'Admins must use the Admin Web Portal.', 403);
    }

    if (!user.email_confirmed_at) {
      return authError(
        'EMAIL_NOT_CONFIRMED',
        'Confirm your email before signing in. Check your inbox for the verification code.',
        403,
      );
    }

    if (user.banned_until) {
      const bannedUntil = new Date(user.banned_until);
      if (!Number.isNaN(bannedUntil.getTime()) && bannedUntil > new Date()) {
        return authError('ACCOUNT_DISABLED', 'This account has been disabled. Contact support for help.', 403);
      }
    }

    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !anonKey) {
      throw new Error('Missing Supabase env.');
    }

    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return authError('WRONG_PASSWORD', 'Incorrect password. Try again or reset it.', 401);
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
