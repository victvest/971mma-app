/**
 * notification-push
 *
 * Called by a Postgres trigger (via pg_net) whenever a new row is inserted into
 * the `notifications` table. Sends the notification as an Expo device push to
 * every push token registered for that user.
 *
 * Handles all notification types EXCEPT those already pushed by dedicated
 * schedulers (class-reminders, streak-reminders) or community flow.
 *
 * Auth: protected by the Supabase service role key passed as Bearer token.
 *       The trigger reads this from vault.decrypted_secrets.
 */

import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { serviceClient } from '../_shared/supabase.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PUSH_CHANNEL_IDS = {
  academy: 'academy-updates',
  classes: 'class-reminders',
  progress: 'progress-updates',
  rewards: 'rewards-updates',
  family: 'family-updates',
  community: 'community-updates',
} as const;

/**
 * Notification types already pushed by dedicated schedulers.
 * Skipped here to avoid double-pushing.
 */
const ALREADY_PUSHED_TYPES = new Set([
  'class_reminder',
  'class_cancelled',
  'streak_warning',
  'referral',
  // Community activity remains available in the in-app inbox. Only targeted
  // academy broadcasts should interrupt the member's phone.
  'community',
  'feed_like',
  'feed_comment',
]);

type NotificationPushRequest = {
  user_id?: unknown;
  type?: unknown;
  payload?: unknown;
};

type PushTokenRow = {
  expo_push_token: string;
};

function parseRequest(body: NotificationPushRequest): {
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
} {
  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
  const type = typeof body.type === 'string' ? body.type.trim() : '';
  const payload =
    body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : {};

  if (!userId || !type) {
    throw new MbError('BAD_REQUEST', 'user_id and type are required.');
  }

  const rawTitle =
    (typeof payload.title === 'string' ? payload.title.trim() : '') ||
    (typeof payload.subject === 'string' ? payload.subject.trim() : '');
  const rawBody =
    (typeof payload.body === 'string' ? payload.body.trim() : '') ||
    (typeof payload.message === 'string' ? payload.message.trim() : '') ||
    (typeof payload.content === 'string' ? payload.content.trim() : '') ||
    (typeof payload.text === 'string' ? payload.text.trim() : '');

  const title = rawTitle || humanizeType(type);
  const pushBody = rawBody || '971 MMA';

  return { userId, type, title, body: pushBody, data: { type, ...payload } };
}

function humanizeType(type: string): string {
  const map: Record<string, string> = {
    announcement: '971 MMA Announcement',
    class_attendance: 'Class Attendance',
    milestone: 'Milestone Unlocked! 🏆',
    promotion: 'Belt Promotion! 🥋',
    reward: 'Rewards & Points',
    referral: 'Referral Update',
    feed_like: 'Community Feed',
    feed_comment: 'Community Feed',
    community: '971 MMA Community',
    parent_child: 'Family & Trainee Update',
    guardian_alert: 'Guardian Alert',
    belt: 'Belt Progression',
    progression: 'Skill Progression',
  };
  return map[type.toLowerCase()] ?? '971 MMA';
}

function notificationChannelId(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized === 'class_attendance') return PUSH_CHANNEL_IDS.classes;
  if (
    normalized === 'milestone' ||
    normalized === 'promotion' ||
    normalized === 'belt' ||
    normalized === 'progression'
  ) {
    return PUSH_CHANNEL_IDS.progress;
  }
  if (normalized === 'reward' || normalized === 'redemption') return PUSH_CHANNEL_IDS.rewards;
  if (normalized === 'parent_child' || normalized === 'guardian_alert') {
    return PUSH_CHANNEL_IDS.family;
  }
  return PUSH_CHANNEL_IDS.academy;
}

function requireAuth(req: Request): void {
  const secret = Deno.env.get('NOTIFICATION_PUSH_SECRET');
  if (!secret) {
    throw new MbError('UPSTREAM_ERROR', 'Missing NOTIFICATION_PUSH_SECRET', 500);
  }

  const authorization = req.headers.get('authorization')?.trim() ?? '';
  const bearer = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : null;

  if (bearer !== secret) {
    throw new MbError('UNAUTHORIZED', 'Unauthorized.');
  }
}

async function sendExpoPush(
  svc: ReturnType<typeof serviceClient>,
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown>,
  type: string,
): Promise<void> {
  if (tokens.length === 0) return;

  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    data,
    sound: 'default',
    priority: 'high',
    channelId: notificationChannelId(type),
  }));

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  const accessToken = Deno.env.get('EXPO_PUSH_ACCESS_TOKEN');
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`[notification-push] Expo push failed (${response.status}): ${text}`);
    return;
  }

  const resJson = await response.json().catch(() => ({}));
  const tickets: Array<{ status?: string; details?: { error?: string } }> = Array.isArray(
    resJson?.data,
  )
    ? resJson.data
    : resJson?.data
      ? [resJson.data]
      : [];

  const staleTokens: string[] = [];
  tickets.forEach((ticket, index) => {
    if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      const token = tokens[index];
      if (token) staleTokens.push(token);
    }
  });

  if (staleTokens.length > 0) {
    await svc.from('push_tokens').delete().in('expo_push_token', staleTokens);
  }
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse(
      { error: { code: 'BAD_REQUEST', message: 'POST required.' } },
      { status: 405 },
    );
  }

  try {
    requireAuth(req);

    const raw = (await req.json().catch(() => ({}))) as NotificationPushRequest;
    const input = parseRequest(raw);

    // Skip types already handled by other push mechanisms
    if (ALREADY_PUSHED_TYPES.has(input.type)) {
      return jsonResponse({ ok: true, skipped: true, reason: 'not_phone_push_type' });
    }

    // Facility entry is intentionally silent on the phone. Guardians can still
    // see the event in the in-app history if the row was created.
    if (input.type === 'parent_child' && input.data.eventType === 'check_in') {
      return jsonResponse({ ok: true, skipped: true, reason: 'facility_entry_is_silent' });
    }

    const svc = serviceClient();

    const { data, error } = await svc
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', input.userId);

    if (error) {
      console.error(
        `[notification-push] Failed to load tokens for ${input.userId}: ${error.message}`,
      );
      return jsonResponse({ ok: false, error: error.message }, { status: 500 });
    }

    const tokens = ((data ?? []) as PushTokenRow[])
      .map((r) => r.expo_push_token.trim())
      .filter(Boolean);

    await sendExpoPush(svc, tokens, input.title, input.body, input.data, input.type);

    return jsonResponse({ ok: true, tokenCount: tokens.length });
  } catch (error) {
    return toErrorResponse(error);
  }
});
