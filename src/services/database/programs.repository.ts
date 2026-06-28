import { getSupabaseClient } from '@/services/supabase/client';
import type { ProgramRow } from '@/types/database';

export type ProgramItem = {
  id: string;
  name: string;
  discipline: string | null;
};

export async function getPrograms(): Promise<ProgramItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('programs')
    .select('id, name, discipline')
    .eq('active', true)
    .order('name');

  if (error) throw error;
  return (data as Pick<ProgramRow, 'id' | 'name' | 'discipline'>[]).map((row) => ({
    id: row.id,
    name: row.name,
    discipline: row.discipline,
  }));
}
