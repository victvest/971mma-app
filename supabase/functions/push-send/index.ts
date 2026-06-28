import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireInternalSecret } from '../_shared/internalAuth.ts';
import { sendPushToUsers, type PushData } from '../_shared/push.ts';
import { serviceClient } from '../_shared/supabase.ts';

type PushSendRequest = {
  userIds?: unknown;
  title?: unknown;
  body?: unknown;
  data?: unknown;
  ttl?: unknown;
  expiration?: unknown;
};

function parseRequest(body: PushSendRequest): {
  userIds: string[];
  title: string;
  body: string;
  data: PushData;
  ttl?: number;
  expiration?: number;
} {
  const userIds = Array.isArray(body.userIds)
    ? body.userIds.filter((value): value is string => typeof value === 'string' && value.trim())
    : [];
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const messageBody = typeof body.body === 'string' ? body.body.trim() : '';
  const data =
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? (body.data as PushData)
      : null;

  if (userIds.length === 0 || !title || !messageBody || !data) {
    throw new MbError('BAD_REQUEST', 'userIds, title, body, and data are required.');
  }

  return {
    userIds,
    title,
    body: messageBody,
    data,
    ...(typeof body.ttl === 'number' ? { ttl: body.ttl } : {}),
    ...(typeof body.expiration === 'number' ? { expiration: body.expiration } : {}),
  };
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
    requireInternalSecret(req);
    const input = parseRequest((await req.json().catch(() => ({}))) as PushSendRequest);
    const result = await sendPushToUsers(serviceClient(), input);
    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    return toErrorResponse(error);
  }
});
