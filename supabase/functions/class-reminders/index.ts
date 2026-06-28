import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireInternalSecret } from '../_shared/internalAuth.ts';
import { sendPushToUsers } from '../_shared/push.ts';
import { serviceClient } from '../_shared/supabase.ts';

const REMINDER_WINDOW_START_MINUTES = 55;
const REMINDER_WINDOW_END_MINUTES = 65;
const CANCELLATION_LOOKBACK_HOURS = 24;
const GYM_TIME_ZONE = 'Asia/Dubai';

type ClassPushRow = {
  id: string;
  title: string | null;
  discipline: string | null;
  coach_name: string | null;
  starts_at: string;
  duration_minutes: number | null;
  is_cancelled: boolean;
};

type SubscriptionWithClass = {
  id: string;
  user_id: string;
  class_id: string;
  classes: ClassPushRow | ClassPushRow[] | null;
};

type ClassPushGroup = {
  klass: ClassPushRow;
  subscriptionIds: string[];
  userIds: string[];
};

type ServiceClient = ReturnType<typeof serviceClient>;

function isoMinutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
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

function classLabel(klass: ClassPushRow): string {
  return cleanLabel(klass.discipline) ?? cleanLabel(klass.title) ?? 'class';
}

function classTitle(klass: ClassPushRow): string {
  return cleanLabel(klass.title) ?? classLabel(klass);
}

function readJoinedClass(row: SubscriptionWithClass): ClassPushRow | null {
  if (Array.isArray(row.classes)) return row.classes[0] ?? null;
  return row.classes;
}

function groupByClass(rows: SubscriptionWithClass[]): ClassPushGroup[] {
  const groups = new Map<string, ClassPushGroup>();

  rows.forEach((row) => {
    const klass = readJoinedClass(row);
    if (!klass) return;

    const existing = groups.get(klass.id);
    if (existing) {
      existing.subscriptionIds.push(row.id);
      existing.userIds.push(row.user_id);
      return;
    }

    groups.set(klass.id, {
      klass,
      subscriptionIds: [row.id],
      userIds: [row.user_id],
    });
  });

  return Array.from(groups.values());
}

async function markSubscriptions(
  svc: ServiceClient,
  ids: string[],
  column: 'reminder_sent_at' | 'cancellation_notified_at',
): Promise<void> {
  if (ids.length === 0) return;

  const { error } = await svc
    .from('class_subscriptions')
    .update({ [column]: new Date().toISOString() })
    .in('id', ids)
    .is(column, null);

  if (error) {
    throw new MbError('UPSTREAM_ERROR', `Unable to mark subscriptions: ${error.message}`);
  }
}

async function loadReminderRows(svc: ServiceClient): Promise<SubscriptionWithClass[]> {
  const { data, error } = await svc
    .from('class_subscriptions')
    .select(
      'id, user_id, class_id, classes!inner(id, title, discipline, coach_name, starts_at, duration_minutes, is_cancelled)',
    )
    .is('reminder_sent_at', null)
    .eq('classes.is_cancelled', false)
    .gte('classes.starts_at', isoMinutesFromNow(REMINDER_WINDOW_START_MINUTES))
    .lte('classes.starts_at', isoMinutesFromNow(REMINDER_WINDOW_END_MINUTES));

  if (error) {
    throw new MbError('UPSTREAM_ERROR', `Unable to load class reminders: ${error.message}`);
  }

  return (data ?? []) as SubscriptionWithClass[];
}

async function loadCancellationRows(svc: ServiceClient): Promise<SubscriptionWithClass[]> {
  const { data, error } = await svc
    .from('class_subscriptions')
    .select(
      'id, user_id, class_id, classes!inner(id, title, discipline, coach_name, starts_at, duration_minutes, is_cancelled)',
    )
    .is('cancellation_notified_at', null)
    .eq('classes.is_cancelled', true)
    .gte(
      'classes.starts_at',
      new Date(Date.now() - CANCELLATION_LOOKBACK_HOURS * 60 * 60_000).toISOString(),
    );

  if (error) {
    throw new MbError('UPSTREAM_ERROR', `Unable to load class cancellations: ${error.message}`);
  }

  return (data ?? []) as SubscriptionWithClass[];
}

async function sendReminderGroup(svc: ServiceClient, group: ClassPushGroup): Promise<void> {
  const time = formatGymTime(group.klass.starts_at);
  const title = 'Class reminder';
  const body = `Your ${time} ${classLabel(group.klass)} class starts in 1 hour - on your way?`;

  await sendPushToUsers(svc, {
    userIds: group.userIds,
    title,
    body,
    expiration: Math.floor(new Date(group.klass.starts_at).getTime() / 1000),
    data: {
      type: 'class_reminder',
      classId: group.klass.id,
      url: `/classes/${group.klass.id}`,
      classTitle: group.klass.title,
      discipline: group.klass.discipline,
      coachName: group.klass.coach_name,
      startsAt: group.klass.starts_at,
    },
  });

  await markSubscriptions(svc, group.subscriptionIds, 'reminder_sent_at');
}

async function sendCancellationGroup(svc: ServiceClient, group: ClassPushGroup): Promise<void> {
  const time = formatGymTime(group.klass.starts_at);
  const title = 'Class cancelled';
  const body = `${time} ${classTitle(group.klass)} has been cancelled.`;

  await sendPushToUsers(svc, {
    userIds: group.userIds,
    title,
    body,
    data: {
      type: 'class_cancelled',
      classId: group.klass.id,
      url: `/classes/${group.klass.id}`,
      classTitle: group.klass.title,
      discipline: group.klass.discipline,
      coachName: group.klass.coach_name,
      startsAt: group.klass.starts_at,
    },
  });

  await markSubscriptions(svc, group.subscriptionIds, 'cancellation_notified_at');
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
    const svc = serviceClient();

    const reminderGroups = groupByClass(await loadReminderRows(svc));
    for (const group of reminderGroups) {
      await sendReminderGroup(svc, group);
    }

    const cancellationGroups = groupByClass(await loadCancellationRows(svc));
    for (const group of cancellationGroups) {
      await sendCancellationGroup(svc, group);
    }

    return jsonResponse({
      ok: true,
      reminderClassCount: reminderGroups.length,
      reminderSubscriptionCount: reminderGroups.reduce(
        (sum, group) => sum + group.subscriptionIds.length,
        0,
      ),
      cancellationClassCount: cancellationGroups.length,
      cancellationSubscriptionCount: cancellationGroups.reduce(
        (sum, group) => sum + group.subscriptionIds.length,
        0,
      ),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
