import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { mindbodyLocalDateTimeToIso } from '../_shared/gymTime.ts';
import { sendPushToUsers } from '../_shared/push.ts';
import { serviceClient } from '../_shared/supabase.ts';

type WebhookPayload = Record<string, unknown>;

const GYM_TIME_ZONE = 'Asia/Dubai';

const SIGNATURE_HEADER = 'X-Mindbody-Signature';
const KNOWN_EVENT_PREFIXES = ['classRosterBookingStatus.', 'classSchedule.', 'client.', 'staff.'];

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let i = 0; i < length; i += 1) {
    diff |= (leftBytes[i] ?? 0) ^ (rightBytes[i] ?? 0);
  }

  return diff === 0;
}

async function hmacSha256(secret: string, body: ArrayBuffer): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, body);
  return new Uint8Array(signature);
}

async function verifySignature(req: Request, body: ArrayBuffer): Promise<boolean> {
  const secret = Deno.env.get('MINDBODY_WEBHOOK_SECRET');
  const provided = req.headers.get(SIGNATURE_HEADER)?.trim();

  if (!secret || !provided) return false;

  const signature = await hmacSha256(secret, body);
  const base64 = bytesToBase64(signature);
  const expected = [base64, toBase64Url(base64), bytesToHex(signature)];

  return expected.some((candidate) => timingSafeEqual(candidate, provided));
}

function readString(payload: WebhookPayload, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function readNumber(payload: WebhookPayload, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return fallback;
}

function readBoolean(payload: WebhookPayload, keys: string[], fallback = false): boolean {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
    }
  }
  return fallback;
}

function readObject(payload: WebhookPayload, keys: string[]): WebhookPayload | null {
  for (const key of keys) {
    const value = payload[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as WebhookPayload;
    }
  }
  return null;
}

function nestedPayload(payload: WebhookPayload, keys: string[]): WebhookPayload {
  return readObject(payload, keys) ?? payload;
}

function durationMinutes(start: string, end: string): number {
  const minutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
  return Number.isFinite(minutes) ? Math.max(1, minutes) : 60;
}

function formatGymTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: GYM_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(iso))
    .replace(':00', '');
}

function cleanLabel(value: string | null | undefined): string | null {
  const label = value?.trim();
  return label ? label : null;
}

async function sendCancellationPushForClass(classId: string): Promise<void> {
  const svc = serviceClient();
  const { data: klass, error: classError } = await svc
    .from('classes')
    .select('id, title, discipline, coach_name, starts_at')
    .eq('id', classId)
    .maybeSingle<{
      id: string;
      title: string | null;
      discipline: string | null;
      coach_name: string | null;
      starts_at: string;
    }>();

  if (classError || !klass) return;

  const { data: subscriptions, error: subscriptionError } = await svc
    .from('class_subscriptions')
    .select('id, user_id')
    .eq('class_id', classId)
    .is('cancellation_notified_at', null);

  if (subscriptionError || !subscriptions?.length) return;

  const classTitle = cleanLabel(klass.title) ?? cleanLabel(klass.discipline) ?? 'Class';
  const body = `${formatGymTime(klass.starts_at)} ${classTitle} has been cancelled.`;

  await sendPushToUsers(svc, {
    userIds: subscriptions.map((subscription) => subscription.user_id),
    title: 'Class cancelled',
    body,
    data: {
      type: 'class_cancelled',
      classId,
      url: `/classes/${classId}`,
      classTitle: klass.title,
      discipline: klass.discipline,
      coachName: klass.coach_name,
      startsAt: klass.starts_at,
    },
  });

  await svc
    .from('class_subscriptions')
    .update({ cancellation_notified_at: new Date().toISOString() })
    .in(
      'id',
      subscriptions.map((subscription) => subscription.id),
    )
    .is('cancellation_notified_at', null);
}

async function sha256Hex(body: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', body.slice(0));
  return bytesToHex(new Uint8Array(digest));
}

function parsePayload(text: string): WebhookPayload {
  const parsed = JSON.parse(text);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as WebhookPayload)
    : {};
}

function isKnownEvent(eventType: string | null): boolean {
  if (!eventType) return false;
  return KNOWN_EVENT_PREFIXES.some((prefix) => eventType.startsWith(prefix));
}

async function bestEffortStaffMirror(_payload: WebhookPayload): Promise<void> {
  // Coach directory is academy-curated; Mindbody staff webhooks are ignored.
  return;
}

async function bestEffortClassMirror(payload: WebhookPayload): Promise<void> {
  const eventType = readString(payload, ['eventType', 'EventType', 'type']);
  if (
    !eventType ||
    (!eventType.startsWith('classSchedule.') &&
      !eventType.startsWith('class.') &&
      !eventType.startsWith('classRosterBookingStatus.'))
  ) {
    return;
  }

  const klass = nestedPayload(payload, [
    'class',
    'Class',
    'classSchedule',
    'ClassSchedule',
    'classRosterBooking',
    'ClassRosterBooking',
    'data',
    'Data',
  ]);
  const description = readObject(klass, ['ClassDescription', 'classDescription']) ?? {};
  const staff = readObject(klass, ['Staff', 'staff']) ?? {};
  const mindbodyClassId = readString(klass, [
    'Id',
    'id',
    'ClassId',
    'classId',
    'ClassScheduleId',
    'classScheduleId',
  ]);

  if (!mindbodyClassId) return;

  const cancelledByEvent = /cancel/i.test(eventType);
  const syncedAt = new Date().toISOString();

  if (eventType.startsWith('classRosterBookingStatus.')) {
    const bookedCount = readNumber(klass, ['TotalBooked', 'totalBooked', 'BookedCount', 'bookedCount'], -1);
    const availability = readBoolean(klass, ['IsAvailable', 'isAvailable'], true);
    const patch: Record<string, unknown> = { last_synced_at: syncedAt };
    if (bookedCount >= 0) patch.booked_count = bookedCount;
    patch.is_available = availability;

    await serviceClient()
      .from('classes')
      .update(patch)
      .eq('mindbody_class_id', mindbodyClassId);
    return;
  }

  if (cancelledByEvent) {
    const svc = serviceClient();
    const { data: existingClass } = await svc
      .from('classes')
      .select('id, is_cancelled')
      .eq('mindbody_class_id', mindbodyClassId)
      .maybeSingle<{ id: string; is_cancelled: boolean }>();

    await svc
      .from('classes')
      .update({ is_cancelled: true, is_available: false, last_synced_at: syncedAt })
      .eq('mindbody_class_id', mindbodyClassId);

    if (existingClass?.id && !existingClass.is_cancelled) {
      await sendCancellationPushForClass(existingClass.id);
    }
    return;
  }

  const rawStartsAt = readString(klass, ['StartDateTime', 'startDateTime', 'StartTime', 'startTime']);
  const rawEndsAt = readString(klass, ['EndDateTime', 'endDateTime', 'EndTime', 'endTime']);
  const title =
    readString(description, ['Name', 'name']) ??
    readString(klass, ['Name', 'name', 'Title', 'title']);

  if (!rawStartsAt || !rawEndsAt || !title) {
    return;
  }

  const startsAt = mindbodyLocalDateTimeToIso(rawStartsAt);
  const endsAt = mindbodyLocalDateTimeToIso(rawEndsAt);
  if (!startsAt || !endsAt) {
    return;
  }

  await serviceClient()
    .from('classes')
    .upsert(
      {
        mindbody_class_id: mindbodyClassId,
        title,
        discipline:
          readString(description, ['SessionTypeName', 'sessionTypeName', 'ProgramName', 'programName']) ??
          readString(klass, ['Discipline', 'discipline']) ??
          'General',
        description: readString(description, ['Description', 'description']),
        coach_name: readString(staff, ['Name', 'name']) ?? readString(klass, ['StaffName', 'staffName']) ?? 'Coach',
        starts_at: startsAt,
        duration_minutes: durationMinutes(startsAt, endsAt),
        capacity: readNumber(klass, ['MaxCapacity', 'maxCapacity', 'Capacity', 'capacity'], 0),
        level: readString(description, ['Level', 'level']) ?? 'All Levels',
        staff_mindbody_id: readString(staff, ['Id', 'id', 'StaffId', 'staffId']),
        booked_count: readNumber(klass, ['TotalBooked', 'totalBooked', 'BookedCount', 'bookedCount'], 0),
        is_available: readBoolean(klass, ['IsAvailable', 'isAvailable'], true),
        is_waitlist_available: readBoolean(
          klass,
          ['IsWaitlistAvailable', 'isWaitlistAvailable'],
          false,
        ),
        is_cancelled: readBoolean(klass, ['IsCanceled', 'IsCancelled', 'isCanceled', 'isCancelled'], false),
        last_synced_at: syncedAt,
      },
      { onConflict: 'mindbody_class_id' },
    );
}

async function bestEffortClientMirror(payload: WebhookPayload): Promise<void> {
  const eventType = readString(payload, ['eventType', 'EventType', 'type']);
  if (!eventType?.startsWith('client.')) return;

  const client = nestedPayload(payload, ['client', 'Client', 'data', 'Data']);
  const clientId = readString(client, ['Id', 'id', 'ClientId', 'clientId']);
  if (!clientId) return;

  const { data: link } = await serviceClient()
    .from('mindbody_links')
    .select('user_id')
    .eq('mindbody_client_id', clientId)
    .maybeSingle<{ user_id: string }>();

  if (!link?.user_id) return;

  const firstName = readString(client, ['FirstName', 'firstName']);
  const lastName = readString(client, ['LastName', 'lastName']);
  const fullName =
    readString(client, ['Name', 'name', 'FullName', 'fullName']) ??
    [firstName, lastName].filter(Boolean).join(' ');

  const patch: Record<string, unknown> = { mindbody_synced_at: new Date().toISOString() };
  if (fullName) patch.full_name = fullName;
  const phone = readString(client, ['MobilePhone', 'mobilePhone', 'HomePhone', 'homePhone']);
  if (phone) patch.phone = phone;
  const avatarUrl = readString(client, ['PhotoUrl', 'photoUrl', 'ImageUrl', 'imageUrl']);
  if (avatarUrl) patch.avatar_url = avatarUrl;

  await serviceClient().from('profiles').update(patch).eq('id', link.user_id);
}

async function processKnownEvent(payload: WebhookPayload): Promise<void> {
  await Promise.all([
    bestEffortStaffMirror(payload),
    bestEffortClassMirror(payload),
    bestEffortClientMirror(payload),
  ]);
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

  const rawBody = await req.arrayBuffer();
  const validSignature = await verifySignature(req, rawBody);

  if (!validSignature) {
    return jsonResponse(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid signature.' } },
      { status: 401 },
    );
  }

  const bodyText = new TextDecoder().decode(rawBody);
  const payload = parsePayload(bodyText);
  const eventType = readString(payload, ['eventType', 'EventType', 'type']) ?? 'unknown';
  const eventId =
    readString(payload, ['eventId', 'EventId', 'id', 'Id', 'messageId', 'MessageId']) ??
    `${eventType}:${await sha256Hex(rawBody)}`;

  const svc = serviceClient();
  const { error: insertError } = await svc.from('mindbody_webhook_events').insert({
    event_id: eventId,
    event_type: eventType,
    payload,
    status: 'received',
  });

  if (insertError?.code === '23505') {
    return jsonResponse({ ok: true, duplicate: true });
  }

  if (insertError) {
    return jsonResponse(
      { error: { code: 'UPSTREAM_ERROR', message: 'Unable to store event.' } },
      { status: 500 },
    );
  }

  if (isKnownEvent(eventType)) {
    // Process in the background without awaiting the promise
    (async () => {
      try {
        await processKnownEvent(payload);
        await svc
          .from('mindbody_webhook_events')
          .update({ status: 'processed', processed_at: new Date().toISOString() })
          .eq('event_id', eventId);
      } catch (err) {
        console.error(`Failed to process webhook event ${eventId}:`, err);
        await svc
          .from('mindbody_webhook_events')
          .update({ status: 'failed' })
          .eq('event_id', eventId);
      }
    })();
  }

  return jsonResponse({ ok: true, duplicate: false });
});
