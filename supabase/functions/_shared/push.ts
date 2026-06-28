import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1';
import { MbError } from './errors.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_BATCH_SIZE = 100;
const CLASS_REMINDER_CHANNEL_ID = 'class-reminders';

export type PushData = Record<string, unknown>;

export type SendPushInput = {
  userIds: string[];
  title: string;
  body: string;
  data: PushData;
  ttl?: number;
  expiration?: number;
  insertInApp?: boolean;
};

export type SendPushResult = {
  userCount: number;
  tokenCount: number;
  ticketCount: number;
  staleTokenCount: number;
  inAppCount: number;
};

type PushTokenRow = {
  user_id: string;
  expo_push_token: string;
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: PushData;
  sound: 'default';
  priority: 'default' | 'normal' | 'high';
  channelId: string;
  ttl?: number;
  expiration?: number;
};

type ExpoPushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
};

type ExpoPushResponse = {
  data?: ExpoPushTicket | ExpoPushTicket[];
  errors?: Array<{
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  }>;
};

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function readClassId(data: PushData): string | null {
  const value = data.classId ?? data.class_id;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNotificationType(data: PushData): string | null {
  const value = data.type;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function expoTicketsFromResponse(body: ExpoPushResponse): ExpoPushTicket[] {
  if (!body.data) return [];
  return Array.isArray(body.data) ? body.data : [body.data];
}

async function insertInAppNotifications(
  svc: SupabaseClient,
  userIds: string[],
  input: SendPushInput,
): Promise<number> {
  const notificationType = readNotificationType(input.data);
  const classId = readClassId(input.data);
  const payload = {
    ...input.data,
    title: input.title,
    body: input.body,
  };

  if (
    notificationType &&
    classId &&
    (notificationType === 'class_reminder' || notificationType === 'class_cancelled')
  ) {
    const { data, error } = await svc.rpc('insert_class_notifications_once', {
      p_user_ids: userIds,
      p_type: notificationType,
      p_class_id: classId,
      p_payload: payload,
    });

    if (error) {
      throw new MbError('UPSTREAM_ERROR', `Unable to insert notifications: ${error.message}`);
    }

    return typeof data === 'number' ? data : 0;
  }

  const rows = userIds.map((userId) => ({
    user_id: userId,
    type: notificationType ?? 'push',
    payload,
  }));

  const { error } = await svc.from('notifications').insert(rows);
  if (error) {
    throw new MbError('UPSTREAM_ERROR', `Unable to insert notifications: ${error.message}`);
  }

  return rows.length;
}

async function deleteStaleTokens(
  svc: SupabaseClient,
  tokens: string[],
): Promise<number> {
  const staleTokens = uniqueStrings(tokens);
  if (staleTokens.length === 0) return 0;

  const { error } = await svc
    .from('push_tokens')
    .delete()
    .in('expo_push_token', staleTokens);

  if (error) {
    throw new MbError('UPSTREAM_ERROR', `Unable to delete stale push tokens: ${error.message}`);
  }

  return staleTokens.length;
}

async function postExpoBatch(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
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
  const body = (await response.json().catch(() => ({}))) as ExpoPushResponse;

  if (!response.ok || body.errors?.length) {
    const message = body.errors?.[0]?.message ?? 'Expo Push API rejected the request.';
    throw new MbError('UPSTREAM_ERROR', message, response.ok ? 502 : response.status);
  }

  return expoTicketsFromResponse(body);
}

export async function sendPushToUsers(
  svc: SupabaseClient,
  input: SendPushInput,
): Promise<SendPushResult> {
  const userIds = uniqueStrings(input.userIds);
  if (userIds.length === 0) {
    return {
      userCount: 0,
      tokenCount: 0,
      ticketCount: 0,
      staleTokenCount: 0,
      inAppCount: 0,
    };
  }

  const inAppCount =
    input.insertInApp === false
      ? 0
      : await insertInAppNotifications(svc, userIds, input);

  const { data, error } = await svc
    .from('push_tokens')
    .select('user_id, expo_push_token')
    .in('user_id', userIds);

  if (error) {
    throw new MbError('UPSTREAM_ERROR', `Unable to load push tokens: ${error.message}`);
  }

  const tokenRows = ((data ?? []) as PushTokenRow[]).filter((row) =>
    row.expo_push_token.trim(),
  );

  if (tokenRows.length === 0) {
    return {
      userCount: userIds.length,
      tokenCount: 0,
      ticketCount: 0,
      staleTokenCount: 0,
      inAppCount,
    };
  }

  const messages = tokenRows.map<ExpoPushMessage>((row) => ({
    to: row.expo_push_token,
    title: input.title,
    body: input.body,
    data: input.data,
    sound: 'default',
    priority: 'high',
    channelId: CLASS_REMINDER_CHANNEL_ID,
    ...(typeof input.ttl === 'number' ? { ttl: input.ttl } : {}),
    ...(typeof input.expiration === 'number' ? { expiration: input.expiration } : {}),
  }));

  let ticketCount = 0;
  const staleTokens: string[] = [];
  const batches = chunk(messages, EXPO_PUSH_BATCH_SIZE);

  for (const batch of batches) {
    const tickets = await postExpoBatch(batch);
    ticketCount += tickets.length;

    tickets.forEach((ticket, index) => {
      if (
        ticket.status === 'error' &&
        ticket.details?.error === 'DeviceNotRegistered'
      ) {
        const token = batch[index]?.to;
        if (token) staleTokens.push(token);
      }
    });
  }

  const staleTokenCount = await deleteStaleTokens(svc, staleTokens);

  return {
    userCount: userIds.length,
    tokenCount: tokenRows.length,
    ticketCount,
    staleTokenCount,
    inAppCount,
  };
}
