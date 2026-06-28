import { getSupabaseClient } from '@/services/supabase/client';
import type { RollCallMemberStatus, RollCallMarkMethod } from '@/features/coach/roll-call/types';

export const CLASS_ATTENDANCE_PAGE_SIZE = 20;

export type ClassSessionAttendanceRow = {
  id: string;
  classId: string;
  userId: string;
  status: RollCallMemberStatus;
  method: RollCallMarkMethod;
  markedAt: string;
  classTitle: string;
  classDiscipline: string;
  classStartsAt: string;
};

type ClassJoin = {
  title: string;
  discipline: string;
  starts_at: string;
};

type DbClassSessionAttendanceRow = {
  id: string;
  class_id: string;
  user_id: string;
  status: RollCallMemberStatus;
  method: RollCallMarkMethod;
  marked_at: string;
  classes: ClassJoin | ClassJoin[] | null;
};

function normalizeClassJoin(classes: DbClassSessionAttendanceRow['classes']): ClassJoin | null {
  if (!classes) return null;
  return Array.isArray(classes) ? (classes[0] ?? null) : classes;
}

function mapRow(row: DbClassSessionAttendanceRow): ClassSessionAttendanceRow {
  const classInfo = normalizeClassJoin(row.classes);
  return {
    id: row.id,
    classId: row.class_id,
    userId: row.user_id,
    status: row.status,
    method: row.method,
    markedAt: row.marked_at,
    classTitle: classInfo?.title ?? 'Class',
    classDiscipline: classInfo?.discipline ?? '',
    classStartsAt: classInfo?.starts_at ?? row.marked_at,
  };
}

export async function fetchClassSessionAttendancePage(
  userId: string,
  offset: number,
): Promise<ClassSessionAttendanceRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('class_session_attendance')
    .select(
      'id, class_id, user_id, status, method, marked_at, classes:class_id ( title, discipline, starts_at )',
    )
    .eq('user_id', userId)
    .order('marked_at', { ascending: false })
    .range(offset, offset + CLASS_ATTENDANCE_PAGE_SIZE - 1);

  if (error) throw error;
  return ((data ?? []) as DbClassSessionAttendanceRow[]).map(mapRow);
}
