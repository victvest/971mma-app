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
