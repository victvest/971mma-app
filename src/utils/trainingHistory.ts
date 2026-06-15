import type { TrainingSession } from '../data/memberFeatures';
import type { CheckInRow, ClassRow } from '../types/database';

export type SessionGroup = {
  key: string;
  title: string;
  sessions: TrainingSession[];
};

const DISCIPLINES = ['BJJ', 'Muay Thai', 'Conditioning', 'MMA'] as const;

export function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;

  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today · ${time}`;
  if (isYesterday) return `Yesterday · ${time}`;
  const day = d.toLocaleDateString(undefined, { weekday: 'short' });
  return `${day} · ${time}`;
}

export function groupLabelForDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Earlier';

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);

  if (d >= weekAgo) return 'This week';

  const sameMonth =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (sameMonth) return 'Earlier this month';

  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function mapCheckInToSession(
  row: CheckInRow,
  cls?: ClassRow | null,
): TrainingSession {
  const checkedInAt = row.checked_in_at;
  return {
    id: row.id,
    checkedInAt,
    date: formatSessionDate(checkedInAt),
    className: cls?.title ?? 'Open gym check-in',
    discipline: cls?.discipline ?? 'Open mat',
    coach: cls?.coach_name ?? 'Front desk',
    durationMin: cls?.duration_minutes ?? 60,
    pointsEarned: 80,
  };
}

export function groupSessions(sessions: TrainingSession[]): SessionGroup[] {
  const map = new Map<string, SessionGroup>();

  for (const session of sessions) {
    const title = groupLabelForDate(session.checkedInAt);
    const key = title.toLowerCase().replace(/\s+/g, '-');
    const existing = map.get(key);
    if (existing) {
      existing.sessions.push(session);
    } else {
      map.set(key, { key, title, sessions: [session] });
    }
  }

  return Array.from(map.values());
}

export function filterSessions(
  sessions: TrainingSession[],
  discipline: string,
): TrainingSession[] {
  if (discipline === 'All') return sessions;
  return sessions.filter((s) => s.discipline.toLowerCase().includes(discipline.toLowerCase()));
}

export function deriveTrainingStats(sessions: TrainingSession[]) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const thisMonth = sessions.filter((s) => new Date(s.checkedInAt) >= monthStart);
  const hoursThisMonth = thisMonth.reduce((sum, s) => sum + s.durationMin, 0) / 60;

  const last = sessions[0];
  const lastCheckIn = last ? formatRelative(last.checkedInAt) : '—';

  return {
    sessionsThisMonth: thisMonth.length,
    monthlyGoal: 20,
    streakDays: estimateStreak(sessions),
    hoursThisMonth,
    disciplineScore: Math.min(99, 72 + thisMonth.length * 2),
    lastCheckIn,
  };
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function estimateStreak(sessions: TrainingSession[]): number {
  if (!sessions.length) return 0;

  const days = new Set(
    sessions.map((s) => {
      const d = new Date(s.checkedInAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);

  while (true) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export const disciplineFilters = ['All', ...DISCIPLINES] as const;
