import { getSupabaseClient } from '@/services/supabase/client';
import type { NotificationItem, NotificationPreferences } from '@/types/domain';
import type { NotificationPreferencesRow, NotificationRow } from '@/types/database';

function payloadTitle(payload: Record<string, unknown>): string | null {
  const title = payload.title;
  return typeof title === 'string' && title.trim() ? title : null;
}

function payloadBody(payload: Record<string, unknown>): string | null {
  const body = payload.body;
  return typeof body === 'string' && body.trim() ? body : null;
}

function mapNotificationRow(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: payloadTitle(row.payload) ?? row.type,
    body: payloadBody(row.payload),
    payload: row.payload,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function mapPreferencesRow(row: NotificationPreferencesRow): NotificationPreferences {
  return {
    userId: row.user_id,
    announcements: row.announcements,
    classReminders: row.class_reminders,
    milestones: row.milestones,
    rewards: row.rewards,
    guardianAlerts: row.guardian_alerts,
    community: row.community,
    updatedAt: row.updated_at,
  };
}

function isMissingRpcError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'PGRST202' ||
    Boolean(error.message?.includes('Could not find the function'))
  );
}

async function getAuthUserId(): Promise<string> {
  const { data, error } = await getSupabaseClient().auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

async function getNotificationPreferencesFromTable(userId: string): Promise<NotificationPreferences> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('notification_preferences')
    .select('user_id, announcements, class_reminders, milestones, rewards, guardian_alerts, community, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return mapPreferencesRow(data as NotificationPreferencesRow);

  const { data: inserted, error: insertError } = await client
    .from('notification_preferences')
    .insert({ user_id: userId })
    .select('user_id, announcements, class_reminders, milestones, rewards, guardian_alerts, community, updated_at')
    .single();

  if (insertError) throw insertError;
  return mapPreferencesRow(inserted as NotificationPreferencesRow);
}

async function updateNotificationPreferencesFromTable(
  userId: string,
  patch: Partial<
    Pick<
      NotificationPreferences,
      | 'announcements'
      | 'classReminders'
      | 'milestones'
      | 'rewards'
      | 'guardianAlerts'
      | 'community'
    >
  >,
): Promise<NotificationPreferences> {
  await getNotificationPreferencesFromTable(userId);

  const update: Record<string, boolean> = {};
  if (patch.announcements !== undefined) update.announcements = patch.announcements;
  if (patch.classReminders !== undefined) update.class_reminders = patch.classReminders;
  if (patch.milestones !== undefined) update.milestones = patch.milestones;
  if (patch.rewards !== undefined) update.rewards = patch.rewards;
  if (patch.guardianAlerts !== undefined) update.guardian_alerts = patch.guardianAlerts;
  if (patch.community !== undefined) update.community = patch.community;

  const { data, error } = await getSupabaseClient()
    .from('notification_preferences')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('user_id, announcements, class_reminders, milestones, rewards, guardian_alerts, community, updated_at')
    .single();

  if (error) throw error;
  return mapPreferencesRow(data as NotificationPreferencesRow);
}

export async function getNotifications(limit = 50): Promise<NotificationItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('notifications')
    .select('id, user_id, type, payload, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as NotificationRow[]).map(mapNotificationRow);
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('mark_notification_read', {
    p_notification: notificationId,
  });
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<number> {
  const { data, error } = await getSupabaseClient().rpc('mark_all_notifications_read');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data, error } = await getSupabaseClient().rpc('get_notification_preferences');
  if (!error && data) {
    return mapPreferencesRow(data as NotificationPreferencesRow);
  }

  if (error && !isMissingRpcError(error)) throw error;

  const userId = await getAuthUserId();
  return getNotificationPreferencesFromTable(userId);
}

export async function updateNotificationPreferences(
  patch: Partial<
    Pick<
      NotificationPreferences,
      | 'announcements'
      | 'classReminders'
      | 'milestones'
      | 'rewards'
      | 'guardianAlerts'
      | 'community'
    >
  >,
): Promise<NotificationPreferences> {
  const { data, error } = await getSupabaseClient().rpc('update_notification_preferences', {
    p_announcements: patch.announcements ?? null,
    p_class_reminders: patch.classReminders ?? null,
    p_milestones: patch.milestones ?? null,
    p_rewards: patch.rewards ?? null,
    p_guardian_alerts: patch.guardianAlerts ?? null,
    p_community: patch.community ?? null,
  });

  if (!error && data) {
    return mapPreferencesRow(data as NotificationPreferencesRow);
  }

  if (error && !isMissingRpcError(error)) throw error;

  const userId = await getAuthUserId();
  return updateNotificationPreferencesFromTable(userId, patch);
}
