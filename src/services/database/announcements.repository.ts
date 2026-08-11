import { getSupabaseClient } from '@/services/supabase/client';
import type { AnnouncementItem } from '@/types/domain';
import type { AnnouncementRow } from '@/types/database';

function mapAnnouncementRow(row: AnnouncementRow): AnnouncementItem {
  return {
    id: row.id,
    authorId: row.author_id,
    channel: row.channel,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function getAnnouncements(limit = 30): Promise<AnnouncementItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('announcements')
    .select('id, author_id, channel, title, body, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as AnnouncementRow[]).map(mapAnnouncementRow);
}

export async function createAnnouncement(input: {
  channel: string;
  title: string;
  body: string;
}): Promise<AnnouncementItem> {
  const { data, error } = await getSupabaseClient().rpc('create_announcement', {
    p_channel: input.channel,
    p_title: input.title,
    p_body: input.body,
  });

  if (error) throw error;
  return mapAnnouncementRow(data as AnnouncementRow);
}

export type CoachAnnouncementAudienceMode = 'general' | 'classes';

export type CoachAnnouncementTargetClass = {
  id: string;
  title: string;
  discipline: string;
  startsAt: string;
  rosterCount: number;
};

export type CoachAnnouncementTargets = {
  classes: CoachAnnouncementTargetClass[];
  generalRecipientCount: number;
};

export type CoachSendAnnouncementResult = {
  announcementId: string;
  channel: string;
  title: string;
  body: string;
  mode: CoachAnnouncementAudienceMode;
  recipientCount: number;
  createdAt: string;
};

type TargetsRpcPayload = {
  classes?: Array<{
    id?: string;
    title?: string;
    discipline?: string;
    startsAt?: string;
    rosterCount?: number;
  }>;
  generalRecipientCount?: number;
};

type SendRpcPayload = {
  announcementId?: string;
  channel?: string;
  title?: string;
  body?: string;
  mode?: string;
  recipientCount?: number;
  createdAt?: string;
};

export async function listCoachAnnouncementTargets(): Promise<CoachAnnouncementTargets> {
  const { data, error } = await getSupabaseClient().rpc('list_coach_announcement_targets');
  if (error) throw error;

  const payload = (data ?? {}) as TargetsRpcPayload;
  return {
    generalRecipientCount: Number(payload.generalRecipientCount ?? 0),
    classes: (payload.classes ?? [])
      .filter((row): row is NonNullable<typeof row> & { id: string } => Boolean(row?.id))
      .map((row) => ({
        id: row.id!,
        title: row.title?.trim() || 'Class',
        discipline: row.discipline?.trim() || 'Class',
        startsAt: row.startsAt ?? '',
        rosterCount: Number(row.rosterCount ?? 0),
      })),
  };
}

export async function coachSendAnnouncement(input: {
  title: string;
  body: string;
  mode: CoachAnnouncementAudienceMode;
  classIds?: string[];
}): Promise<CoachSendAnnouncementResult> {
  const { data, error } = await getSupabaseClient().rpc('coach_send_announcement', {
    p_title: input.title,
    p_body: input.body,
    p_mode: input.mode,
    p_class_ids: input.mode === 'classes' ? (input.classIds ?? []) : null,
  });

  if (error) throw error;

  const payload = (data ?? {}) as SendRpcPayload;
  return {
    announcementId: String(payload.announcementId ?? ''),
    channel: String(payload.channel ?? input.mode),
    title: String(payload.title ?? input.title),
    body: String(payload.body ?? input.body),
    mode: payload.mode === 'classes' ? 'classes' : 'general',
    recipientCount: Number(payload.recipientCount ?? 0),
    createdAt: String(payload.createdAt ?? new Date().toISOString()),
  };
}
