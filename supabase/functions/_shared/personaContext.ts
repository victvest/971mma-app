import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1';
import { PERSONA_ACADEMY_FAQ, PERSONA_APP_AREAS } from './personaKnowledge.ts';

const GYM_TIMEZONE = 'Asia/Dubai';
const SCHEDULE_LOOKAHEAD_DAYS = 7;
const MAX_SCHEDULE_CLASSES = 40;

type ProfileRow = {
  full_name: string | null;
  membership_name: string | null;
  membership_status: string | null;
  membership_expires_at: string | null;
  belt_rank: string | null;
  belt_stripes: number | null;
  member_since: string | null;
};

type ClassRow = {
  id: string;
  title: string;
  discipline: string | null;
  coach_name: string | null;
  coach_id: string | null;
  starts_at: string;
  duration_minutes: number;
  level: string | null;
};

type CoachRow = {
  id: string;
  name: string;
  specialty: string | null;
  rank: string | null;
  is_head_coach: boolean | null;
  languages: string[] | null;
};

type RewardRow = {
  id: string;
  name: string;
  category: string;
  cost_points: number;
};

type RequirementRow = {
  id: string;
  title: string;
  requirement_type: string;
  attendance_target: number | null;
};

type RequirementStatusRow = {
  rank_requirement_id: string;
  status: string;
};

export type PersonaAssistantContext = {
  generatedAt: string;
  gymTimezone: string;
  member: {
    userId: string;
    fullName: string;
    membershipName: string | null;
    membershipStatus: string | null;
    membershipExpiresAt: string | null;
    beltRank: string | null;
    beltStripes: number;
    memberSince: string | null;
    checkedInToday: boolean;
    enrolledDisciplines: string[];
    referralCode: string | null;
  };
  engagement: {
    pointsBalance: number;
    pointsTier: string;
    lifetimePoints: number;
    currentStreak: number;
    bestStreak: number;
    trainingDays: number;
    trainingDays30d: number;
    monthlyGoalPct: number;
    streakStatus: string;
  };
  bookings: Array<{
    status: string;
    classTitle: string;
    startsAtLocal: string;
    coachName: string;
  }>;
  recentCheckins: Array<{
    checkedInAtLocal: string;
    method: string;
    classTitle: string;
    coachName: string;
  }>;
  familyLinks: Array<{
    name: string;
    status: string;
    mode: string;
  }>;
  referrals: Array<{
    email: string;
    status: string;
  }>;
  belt: {
    eligible: boolean;
    discipline: string | null;
    disciplineName: string | null;
    rankName: string | null;
    stripe: number | null;
    maxStripes: number | null;
    percentComplete: number | null;
    requirements: Array<{
      title: string;
      type: string;
      status: string;
      attendanceTarget: number | null;
    }>;
  };
  schedule: {
    upcomingClasses: Array<{
      id: string;
      title: string;
      discipline: string;
      coachName: string;
      coachId: string | null;
      startsAtLocal: string;
      durationMinutes: number;
      level: string;
    }>;
  };
  coaches: Array<{
    id: string;
    name: string;
    specialty: string | null;
    rank: string | null;
    isHeadCoach: boolean;
    languages: string[];
    upcomingClassCount: number;
  }>;
  rewards: {
    catalog: Array<{ id: string; name: string; category: string; costPoints: number }>;
    nextMilestones: Array<{
      name: string;
      unlockDays: number;
      pointsAward: number;
      status: string;
    }>;
  };
  knowledge: {
    faq: typeof PERSONA_ACADEMY_FAQ;
    appAreas: typeof PERSONA_APP_AREAS;
  };
};

function gymLocalDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIMEZONE }).format(new Date());
}

function formatGymLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-AE', {
    timeZone: GYM_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function cleanContextText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed || /^[-–—\s]+$/.test(trimmed) || /^(n\/a|na|null|undefined)$/i.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

function cleanCoachName(value: string | null | undefined): string {
  const cleaned = cleanContextText(value, 'TBA');
  return /^(coach|tba|tbd)$/i.test(cleaned) ? 'TBA' : cleaned;
}

function addDaysIso(dateKey: string, days: number): string {
  const base = new Date(`${dateKey}T00:00:00+04:00`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString();
}

function startOfGymDayIso(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00+04:00`).toISOString();
}

function endOfGymDayIso(dateKey: string): string {
  return new Date(`${dateKey}T23:59:59.999+04:00`).toISOString();
}

async function fetchBeltRequirements(
  client: SupabaseClient,
  userId: string,
  rankLevelId: string | null,
): Promise<PersonaAssistantContext['belt']['requirements']> {
  if (!rankLevelId) return [];

  const [requirementsResult, statusesResult] = await Promise.all([
    client
      .from('rank_requirements')
      .select('id, title, requirement_type, attendance_target, stripe')
      .eq('rank_level_id', rankLevelId)
      .order('stripe', { ascending: true })
      .order('sort_order', { ascending: true })
      .limit(12),
    client
      .from('member_requirement_statuses')
      .select('rank_requirement_id, status')
      .eq('user_id', userId),
  ]);

  if (requirementsResult.error || statusesResult.error) return [];

  const statusMap = new Map<string, string>();
  for (const row of (statusesResult.data ?? []) as RequirementStatusRow[]) {
    statusMap.set(row.rank_requirement_id, row.status);
  }

  return ((requirementsResult.data ?? []) as RequirementRow[]).map((row) => ({
    title: row.title,
    type: row.requirement_type,
    status: statusMap.get(row.id) ?? 'locked',
    attendanceTarget: row.attendance_target,
  }));
}

async function fetchNextMilestones(
  client: SupabaseClient,
  userId: string,
  trainingDays: number,
): Promise<PersonaAssistantContext['rewards']['nextMilestones']> {
  const { data: catalog, error } = await client
    .from('milestones')
    .select('id, name, unlock_days, points_award')
    .eq('active', true)
    .order('unlock_days', { ascending: true })
    .limit(8);

  if (error || !catalog?.length) return [];

  const { data: earnedRows } = await client
    .from('member_milestones')
    .select('milestone_id, status')
    .eq('user_id', userId);

  const earnedIds = new Set(
    ((earnedRows ?? []) as Array<{ milestone_id: string; status: string }>)
      .filter((row) => row.status === 'earned')
      .map((row) => row.milestone_id),
  );

  return (
    catalog as Array<{ id: string; name: string; unlock_days: number; points_award: number | null }>
  )
    .map((row) => {
      const earned = earnedIds.has(row.id) || trainingDays >= row.unlock_days;
      const isNext = !earned && trainingDays < row.unlock_days;
      return {
        name: row.name,
        unlockDays: row.unlock_days,
        pointsAward: row.points_award ?? 0,
        status: earned ? 'earned' : isNext ? 'next' : 'locked',
      };
    })
    .filter((row) => row.status !== 'locked')
    .slice(0, 4);
}

export async function buildPersonaContext(
  client: SupabaseClient,
  userId: string,
): Promise<PersonaAssistantContext> {
  const today = gymLocalDate();
  const rangeEndKey = addDaysIso(today, SCHEDULE_LOOKAHEAD_DAYS).slice(0, 10);
  const nowIso = new Date().toISOString();

  const [
    profileResult,
    dashboardResult,
    classesResult,
    coachesResult,
    catalogResult,
    disciplinesResult,
    checkInResult,
    bookingsResult,
    recentCheckInsResult,
    guardianLinksResult,
    referralsResult,
  ] = await Promise.all([
    client
      .from('profiles')
      .select(
        'full_name, membership_name, membership_status, membership_expires_at, belt_rank, belt_stripes, member_since, referral_code',
      )
      .eq('id', userId)
      .maybeSingle<ProfileRow & { referral_code: string | null }>(),
    client.rpc('get_member_home_dashboard', { p_user: userId }),
    client
      .from('classes')
      .select('id, title, discipline, coach_name, coach_id, starts_at, duration_minutes, level')
      .not('mindbody_class_id', 'is', null)
      .eq('is_cancelled', false)
      .gte('starts_at', nowIso)
      .lte('starts_at', endOfGymDayIso(rangeEndKey))
      .order('starts_at', { ascending: true })
      .limit(MAX_SCHEDULE_CLASSES),
    client
      .from('coaches')
      .select('id, name, specialty, rank, is_head_coach, languages')
      .not('mindbody_staff_id', 'is', null)
      .eq('active', true)
      .eq('visible_in_app', true)
      .is('deleted_at', null)
      .order('is_head_coach', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    client
      .from('rewards_catalog')
      .select('id, name, category, cost_points')
      .eq('active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .limit(20),
    client
      .from('member_disciplines')
      .select('disciplines(display_name)')
      .eq('user_id', userId)
      .eq('active', true),
    client
      .from('check_ins')
      .select('id')
      .eq('user_id', userId)
      .eq('signed_in', true)
      .eq('missed', false)
      .eq('late_cancelled', false)
      .gte('checked_in_at', startOfGymDayIso(today))
      .lte('checked_in_at', endOfGymDayIso(today))
      .limit(1),
    client
      .from('bookings')
      .select('status, classes(title, starts_at, coach_name)')
      .eq('user_id', userId)
      .in('status', ['booked', 'waitlisted'])
      .limit(15),
    client
      .from('check_ins')
      .select('checked_in_at, method, classes(title, coach_name)')
      .eq('user_id', userId)
      .eq('signed_in', true)
      .order('checked_in_at', { ascending: false })
      .limit(10),
    client
      .from('guardian_links')
      .select('child_display_name, status, account_mode')
      .eq('guardian_user_id', userId),
    client
      .from('referrals')
      .select('referred_email, status')
      .eq('referrer_user_id', userId)
      .limit(10),
  ]);

  const dashboard = (dashboardResult.data ?? {}) as Record<string, unknown>;
  const points = (dashboard.points ?? {}) as Record<string, unknown>;
  const disciplineScore = (dashboard.disciplineScore ?? {}) as Record<string, unknown>;
  const rankEligibility = (dashboard.rankEligibility ?? {}) as Record<string, unknown>;
  const beltProgress = (dashboard.beltProgress ?? null) as Record<string, unknown> | null;

  const trainingDays = Number(disciplineScore.trainingDays ?? 0);
  const rankLevelId = typeof beltProgress?.rankId === 'string' ? beltProgress.rankId : null;

  const [requirements, nextMilestones] = await Promise.all([
    fetchBeltRequirements(client, userId, rankLevelId),
    fetchNextMilestones(client, userId, trainingDays),
  ]);

  const classes = ((classesResult.data ?? []) as ClassRow[]).map((row) => ({
    id: row.id,
    title: cleanContextText(row.title, 'Class'),
    discipline: cleanContextText(row.discipline, 'Class'),
    coachName: cleanCoachName(row.coach_name),
    coachId: row.coach_id,
    startsAtLocal: formatGymLocal(row.starts_at),
    durationMinutes: row.duration_minutes,
    level: cleanContextText(row.level, 'All Levels'),
  }));

  const classCountByCoach = new Map<string, number>();
  for (const row of classes) {
    if (!row.coachId) continue;
    classCountByCoach.set(row.coachId, (classCountByCoach.get(row.coachId) ?? 0) + 1);
  }

  const profile = profileResult.data;
  const enrolledDisciplines = (
    (disciplinesResult.data ?? []) as Array<{ disciplines: { display_name: string } | null }>
  )
    .map((row) => row.disciplines?.display_name)
    .filter((name): name is string => Boolean(name));

  const rawBookings = (bookingsResult.data ?? []) as Array<{
    status: string;
    classes: { title: string; starts_at: string; coach_name: string | null } | { title: string; starts_at: string; coach_name: string | null }[] | null;
  }>;
  const bookings = rawBookings
    .map((b) => {
      const cls = Array.isArray(b.classes) ? b.classes[0] : b.classes;
      if (!cls) return null;
      return {
        status: b.status,
        classTitle: cls.title,
        startsAtLocal: formatGymLocal(cls.starts_at),
        startsAtRaw: cls.starts_at,
        coachName: cleanCoachName(cls.coach_name),
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null && new Date(b.startsAtRaw) >= new Date())
    .slice(0, 5);

  const rawCheckins = (recentCheckInsResult.data ?? []) as Array<{
    checked_in_at: string;
    method: string;
    classes: { title: string; coach_name: string | null } | { title: string; coach_name: string | null }[] | null;
  }>;
  const recentCheckins = rawCheckins
    .map((c) => {
      const cls = Array.isArray(c.classes) ? c.classes[0] : c.classes;
      return {
        checkedInAtLocal: formatGymLocal(c.checked_in_at),
        method: c.method,
        classTitle: cls ? cls.title : 'Gym Access',
        coachName: cls ? cleanCoachName(cls.coach_name) : 'TBA',
      };
    })
    .slice(0, 5);

  const rawGuardians = (guardianLinksResult.data ?? []) as Array<{
    child_display_name: string;
    status: string;
    account_mode: string;
  }>;
  const familyLinks = rawGuardians.map((g) => ({
    name: g.child_display_name,
    status: g.status,
    mode: g.account_mode,
  }));

  const rawReferrals = (referralsResult.data ?? []) as Array<{
    referred_email: string;
    status: string;
  }>;
  const referrals = rawReferrals.map((r) => ({
    email: r.referred_email,
    status: r.status,
  }));

  return {
    generatedAt: nowIso,
    gymTimezone: GYM_TIMEZONE,
    member: {
      userId,
      fullName: profile?.full_name?.trim() || 'Member',
      membershipName: profile?.membership_name ?? null,
      membershipStatus: profile?.membership_status ?? null,
      membershipExpiresAt: profile?.membership_expires_at ?? null,
      beltRank: profile?.belt_rank ?? null,
      beltStripes: profile?.belt_stripes ?? 0,
      memberSince: profile?.member_since ?? null,
      checkedInToday: (checkInResult.data ?? []).length > 0,
      enrolledDisciplines,
      referralCode: profile?.referral_code ?? null,
    },
    engagement: {
      pointsBalance: Number(points.balance ?? 0),
      pointsTier: String(points.tier ?? 'bronze'),
      lifetimePoints: Number(points.lifetimePoints ?? 0),
      currentStreak: Number(disciplineScore.currentStreak ?? 0),
      bestStreak: Number(disciplineScore.bestStreak ?? 0),
      trainingDays,
      trainingDays30d: Number(disciplineScore.trainingDays30d ?? 0),
      monthlyGoalPct: Number(disciplineScore.monthlyGoalPct ?? 0),
      streakStatus: String(disciplineScore.streakStatus ?? 'inactive'),
    },
    bookings,
    recentCheckins,
    familyLinks,
    referrals,
    belt: {
      eligible: Boolean(rankEligibility.eligible),
      discipline:
        typeof rankEligibility.disciplineSlug === 'string' ? rankEligibility.disciplineSlug : null,
      disciplineName:
        typeof rankEligibility.disciplineName === 'string' ? rankEligibility.disciplineName : null,
      rankName: typeof beltProgress?.rankName === 'string' ? beltProgress.rankName : null,
      stripe: typeof beltProgress?.stripe === 'number' ? beltProgress.stripe : null,
      maxStripes: typeof beltProgress?.maxStripes === 'number' ? beltProgress.maxStripes : null,
      percentComplete: typeof beltProgress?.percent === 'number' ? beltProgress.percent : null,
      requirements,
    },
    schedule: { upcomingClasses: classes },
    coaches: ((coachesResult.data ?? []) as CoachRow[]).map((coach) => ({
      id: coach.id,
      name: coach.name,
      specialty: coach.specialty,
      rank: coach.rank,
      isHeadCoach: Boolean(coach.is_head_coach),
      languages: coach.languages ?? [],
      upcomingClassCount: classCountByCoach.get(coach.id) ?? 0,
    })),
    rewards: {
      catalog: ((catalogResult.data ?? []) as RewardRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        costPoints: row.cost_points,
      })),
      nextMilestones,
    },
    knowledge: {
      faq: PERSONA_ACADEMY_FAQ,
      appAreas: PERSONA_APP_AREAS,
    },
  };
}

export function buildPersonaSystemPrompt(): string {
  return [
    'You are the 971 MMA academy assistant inside the member mobile app.',
    'Answer ONLY using the provided JSON context about this member, schedule, coaches, belts, rewards, and academy FAQ.',
    'Topics you may cover: classes, schedule, bookings, recent training/check-in history, coaches, belt path, check-in, points, rewards, milestones, referrals, family links, membership status, and app navigation.',
    'Never invent class times, coaches, ranks, points, or policies. If data is missing, say so and suggest Help & Support or the front desk.',
    'Do not answer questions unrelated to 971 MMA, martial arts training at the academy, or this app.',
    '',
    'PRIVACY BOUNDARY (CRITICAL): You only have access to this specific member\'s context (points, rank, check-ins, bookings, linked family members, and referrals) and general public data (FAQ, coaches, schedule). You MUST NOT disclose, speculate, or guess details about other users, coaches\' personal records, or unlinked members. If asked about another member, politely decline citing privacy reasons.',
    '',
    'DATA CAPABILITIES:',
    '- Bookings: Use the `bookings` array to answer if they have booked/scheduled any upcoming classes.',
    '- Recent Check-ins: Use the `recentCheckins` array to answer questions about their training history, past classes attended, and attendance dates.',
    '- Family Links: Use the `familyLinks` array to answer if they have linked children/trainees (and their status).',
    '- Referrals: Use `member.referralCode` to tell them their unique referral code, and the `referrals` array to check friends they referred.',
    '',
    'FORMATTING RULE: You must always structure your response using either Markdown Tables or JSON Cards. NEVER return plain text paragraphs or plain bulleted lists for lists, summaries, or schedules.',
    '',
    '1. Markdown Tables: Use when displaying multiple items like class schedules, lists of coaches, bookings, check-in history, catalog rewards, or milestones.',
    'Example:',
    '| Day/Time | Class | Coach |',
    '| :--- | :--- | :--- |',
    '| Wed, 7:00 PM | MMA | Wellington |',
    '| Wed, 8:00 PM | Boxing | Carl |',
    'Ensure to keep class/item names short and use the first name for coaches/users to fit mobile screen width.',
    '',
    '2. JSON Cards: Use when displaying a profile overview, belt rank progress, points summary, or a single detailed item.',
    'Output the card structure as a ```json code block inside your reply.',
    'The JSON card MUST follow this format:',
    '```json',
    '{',
    '  "type": "card",',
    '  "title": "Card Title (e.g., Profile Status)",',
    '  "subtitle": "Optional Subtitle (e.g., Current Rank)",',
    '  "stats": [',
    '    { "label": "Points", "value": "250 pts" },',
    '    { "label": "Streak", "value": "5 days" }',
    '  ],',
    '  "items": [',
    '    "Requirement 1",',
    '    "Requirement 2"',
    '  ],',
    '  "content": "A short summary paragraph here if needed"',
    '}',
    '```',
    '',
    'Never write placeholder text like "-", "--", "with - -", "null", "undefined", or "TBA" unless the user specifically asks about missing data.',
    'All schedule times in context are already in Dubai gym local time.',
    'For billing, freezes, cancellations, or account changes, direct to info@971mma.com or +971 54 332 3980.',
    'When helpful, include up to 3 action buttons using routes:',
    '- schedule, checkin, belt-path, rewards, coaches, profile, help, referrals',
    '- class:{uuid} for a specific class id from context',
    '- coach:{uuid} for a specific coach id from context',
    'Return JSON with "reply" (string) and optional "actions" array of { label, route }.',
  ].join('\n');
}
