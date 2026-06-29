import { getSupabaseClient } from '@/services/supabase/client';
import type {
  GuardianChildAttendanceSummary,
  GuardianChildMilestoneSummary,
  GuardianChildSummary,
  GuardianChildrenSummary,
} from '@/types/domain';

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function mapMilestone(row: Record<string, unknown>): GuardianChildMilestoneSummary {
  return {
    id: String(row.id ?? ''),
    name: readString(row.name) ?? 'Milestone',
    earnedAt: String(row.earnedAt ?? row.earned_at ?? ''),
  };
}

function mapAttendance(row: Record<string, unknown>): GuardianChildAttendanceSummary {
  return {
    id: String(row.id ?? ''),
    className: readString(row.className) ?? readString(row.class_name) ?? 'Class',
    checkedInAt: String(row.checkedInAt ?? row.checked_in_at ?? ''),
    discipline: readString(row.discipline),
  };
}

function mapChild(row: Record<string, unknown>): GuardianChildSummary {
  const accountMode = row.accountMode === 'independent' ? 'independent' : 'managed';
  const streakStatus = row.streakStatus;
  const normalizedStreakStatus =
    streakStatus === 'active' ||
    streakStatus === 'grace' ||
    streakStatus === 'broken' ||
    streakStatus === 'inactive'
      ? streakStatus
      : 'inactive';

  return {
    traineeUserId: String(row.traineeUserId ?? row.trainee_user_id ?? ''),
    displayName: readString(row.displayName) ?? readString(row.display_name) ?? 'Trainee',
    avatarUrl: readString(row.avatarUrl) ?? readString(row.avatar_url),
    dateOfBirth: readString(row.dateOfBirth) ?? readString(row.date_of_birth),
    accountMode,
    allowGuardianQr: Boolean(row.allowGuardianQr ?? row.allow_guardian_qr ?? false),
    disciplines: Array.isArray(row.disciplines)
      ? row.disciplines.filter((item): item is string => typeof item === 'string')
      : [],
    currentStreak: readNumber(row.currentStreak ?? row.current_streak),
    bestStreak: readNumber(row.bestStreak ?? row.best_streak),
    streakStatus: normalizedStreakStatus,
    rankName: readString(row.rankName) ?? readString(row.rank_name),
    rankStripe:
      typeof row.rankStripe === 'number'
        ? row.rankStripe
        : typeof row.rank_stripe === 'number'
          ? row.rank_stripe
          : null,
    pointsBalance: readNumber(row.pointsBalance ?? row.points_balance),
    recentMilestones: Array.isArray(row.recentMilestones)
      ? row.recentMilestones.map((item) => mapMilestone(item as Record<string, unknown>))
      : [],
    recentAttendance: Array.isArray(row.recentAttendance)
      ? row.recentAttendance.map((item) => mapAttendance(item as Record<string, unknown>))
      : [],
  };
}

export async function getGuardianChildrenSummary(): Promise<GuardianChildrenSummary> {
  const { data, error } = await getSupabaseClient().rpc('get_guardian_children_summary');
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  const children = Array.isArray(payload.children)
    ? payload.children.map((child) => mapChild(child as Record<string, unknown>))
    : [];

  return { children };
}
