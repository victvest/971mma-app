import { getSupabaseClient } from '@/services/supabase/client';
import type { LineageEntryItem } from '@/types/domain';
import type { LineageRow } from '@/types/database';

function mapLineageRow(row: LineageRow): LineageEntryItem {
  return {
    id: row.id,
    yearLabel: row.year_label,
    name: row.name,
    role: row.role,
    note: row.note,
    sortOrder: row.sort_order,
  };
}

export async function getLineageEntries(): Promise<LineageEntryItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('lineage_entries')
    .select('id, year_label, name, role, note, sort_order')
    .order('sort_order', { ascending: true })
    .order('year_label', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as LineageRow[]).map(mapLineageRow);
}
