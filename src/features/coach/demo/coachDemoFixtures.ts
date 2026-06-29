import { gymDayKey } from '@/core/time/gymTime';
import { buildRollCallMockDeck } from '@/features/coach/roll-call/fixtures/rollCallDeckMocks';
import type { RollCallDeckMember } from '@/features/coach/roll-call/types';
import {
  COACH_DEMO_CLASS_PREFIX,
  COACH_DEMO_MEMBER_PREFIX,
} from '@/features/coach/demo/coachDemoMode';
import type {
  BeltPathSummary,
  BeltRequirementItem,
  ClassItem,
  ClassRosterResponse,
  ClassRosterVisitor,
  CoachDashboardStats,
  CoachItem,
  CoachMemberSearchItem,
  CommunityChannelItem,
  PromotionCandidateItem,
} from '@/types/domain';

export const DEMO_COMMUNITY_CHANNEL_PREFIX = 'demo-community-channel-';

export const DEMO_COACH: CoachItem = {
  id: 'demo-coach-profile',
  mindbodyStaffId: '999001',
  name: 'Bahaa',
  specialty: 'Brazilian Jiu-Jitsu',
  rank: 'Black Belt',
  rating: 4.9,
  bio: null,
  photoUrl: null,
  isHeadCoach: true,
  coachingPhilosophy: null,
  yearsExperience: 12,
  fightRecord: null,
  titles: [],
  certifications: [],
  languages: ['English', 'Arabic'],
};

/** Demo coach is BJJ-only — mirrors separate coach accounts per rank discipline. */
export const DEMO_COACH_ASSIGNED_DISCIPLINES = [
  {
    id: 'demo-discipline-bjj',
    slug: 'bjj',
    displayName: 'Brazilian Jiu-Jitsu',
    hasRankProgression: true,
  },
] as const;

export const DEMO_COMMUNITY_CHANNELS: CommunityChannelItem[] = [
  {
    id: 'demo-community-channel-bjj',
    title: 'Bahaa · Brazilian Jiu-Jitsu',
    description: null,
    disciplineName: 'Brazilian Jiu-Jitsu',
    disciplineSlug: 'bjj',
    coachName: DEMO_COACH.name,
    coachAvatarUrl: null,
    latestPostAt: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString(),
    lastMessageAt: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString(),
    lastMessagePreview: 'Open mat this Saturday — bring your gi.',
    unreadCount: 0,
    memberCount: 48,
    isCoachOwner: true,
  },
  {
    id: 'demo-community-channel-nogi',
    title: 'Bahaa · No-Gi',
    description: null,
    disciplineName: 'No-Gi',
    disciplineSlug: 'nogi',
    coachName: DEMO_COACH.name,
    coachAvatarUrl: null,
    latestPostAt: null,
    lastMessageAt: null,
    lastMessagePreview: null,
    unreadCount: 0,
    memberCount: 31,
    isCoachOwner: true,
  },
];

export function getDemoCoachCommunityChannels(): CommunityChannelItem[] {
  return DEMO_COMMUNITY_CHANNELS.map((channel) => ({ ...channel }));
}

export function isDemoCommunityChannelId(channelId: string): boolean {
  return channelId.startsWith(DEMO_COMMUNITY_CHANNEL_PREFIX);
}

export function getDemoCommunityChannels(): CommunityChannelItem[] {
  return getDemoCoachCommunityChannels();
}

function gymTodayIso(hour: number, minute = 0): string {
  const today = gymDayKey();
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${today}T${hh}:${mm}:00+04:00`).toISOString();
}

function tomorrowIso(hour: number, minute = 0): string {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const day = gymDayKey(tomorrow);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${day}T${hh}:${mm}:00+04:00`).toISOString();
}

/** Live class — started 25 minutes ago, 90-minute session. */
export function demoLiveClassStart(): string {
  return new Date(Date.now() - 25 * 60_000).toISOString();
}

function buildDemoClass(
  slug: string,
  title: string,
  startsAt: string,
  options: Partial<ClassItem> = {},
): ClassItem {
  return {
    id: `${COACH_DEMO_CLASS_PREFIX}${slug}`,
    title,
    discipline: 'bjj',
    disciplineId: null,
    description:
      options.description ??
      'Structured session with coach-led technique, positional drilling, and supervised rolling.',
    coachName: DEMO_COACH.name,
    coachId: null,
    startsAt,
    durationMinutes: 90,
    capacity: 24,
    level: 'All levels',
    imageUrl: null,
    bookedCount: options.bookedCount ?? 14,
    isAvailable: true,
    isWaitlistAvailable: false,
    isCancelled: false,
    mindbodyClassId: `demo-mb-${slug}`,
    staffMindbodyId: DEMO_COACH.mindbodyStaffId,
    ...options,
  };
}

export function getDemoCoachClasses(): ClassItem[] {
  const live = buildDemoClass('live', 'No-Gi Fundamentals', demoLiveClassStart(), {
    bookedCount: 14,
    discipline: 'bjj',
  });

  const morning = buildDemoClass('morning', 'Kids BJJ (Ages 8–12)', gymTodayIso(9, 0), {
    durationMinutes: 60,
    bookedCount: 10,
    level: 'Kids',
  });

  const noon = buildDemoClass('noon', 'Gi Fundamentals', gymTodayIso(12, 30), {
    bookedCount: 18,
  });

  const evening = buildDemoClass('evening', 'Advanced No-Gi', gymTodayIso(19, 0), {
    bookedCount: 12,
    level: 'Advanced',
  });

  const tomorrow = buildDemoClass('tomorrow', 'Open Mat', tomorrowIso(10, 0), {
    durationMinutes: 120,
    bookedCount: 8,
    level: 'All levels',
  });

  return [live, morning, noon, evening, tomorrow];
}

export function getDemoCoachClassById(classId: string): ClassItem | null {
  return getDemoCoachClasses().find((item) => item.id === classId) ?? null;
}

export const DEMO_PROMOTION_CANDIDATES: PromotionCandidateItem[] = [
  {
    userId: `${COACH_DEMO_MEMBER_PREFIX}01`,
    fullName: 'Omar Al-Hassan',
    email: 'omar.alhassan@gmail.com',
    beltRank: 'Blue Belt',
    beltStripes: 3,
    percent: 100,
    trainingDays: 84,
    recentCheckIns: 11,
    candidateReason: 'ready_for_stripe',
  },
  {
    userId: `${COACH_DEMO_MEMBER_PREFIX}02`,
    fullName: 'Fatima Al-Mazrouei',
    email: 'fatima.mazrouei@gmail.com',
    beltRank: 'Purple Belt',
    beltStripes: 1,
    percent: 88,
    trainingDays: 76,
    recentCheckIns: 9,
    candidateReason: 'near_ready',
  },
  {
    userId: `${COACH_DEMO_MEMBER_PREFIX}03`,
    fullName: 'Khalid Ibrahim',
    email: 'khalid.ibrahim@gmail.com',
    beltRank: 'White Belt',
    beltStripes: 4,
    percent: 95,
    trainingDays: 91,
    recentCheckIns: 12,
    candidateReason: 'near_ready',
  },
  {
    userId: `${COACH_DEMO_MEMBER_PREFIX}04`,
    fullName: 'James Mitchell',
    email: 'james.mitchell@icloud.com',
    beltRank: 'Purple Belt',
    beltStripes: 1,
    percent: 88,
    trainingDays: 156,
    recentCheckIns: 12,
    candidateReason: 'near_ready',
  },
  {
    userId: `${COACH_DEMO_MEMBER_PREFIX}05`,
    fullName: 'Lucas Ferreira',
    email: 'lucas.ferreira@yahoo.com',
    beltRank: 'White Belt',
    beltStripes: 2,
    percent: 45,
    trainingDays: 28,
    recentCheckIns: 5,
    candidateReason: 'tracking',
  },
];

export function getDemoCoachDashboardStats(): CoachDashboardStats {
  const classes = getDemoCoachClasses();
  const todayCount = classes.filter((item) => {
    const day = gymDayKey();
    const classDay = gymDayKey(new Date(item.startsAt));
    return day === classDay;
  }).length;

  const promoteCount = DEMO_PROMOTION_CANDIDATES.filter(
    (item) => item.candidateReason !== 'tracking',
  ).length;

  return {
    todayClassCount: todayCount,
    liveClassCount: 1,
    todayCheckIns: 47,
    promotionCandidateCount: promoteCount,
  };
}

const DEMO_ROLL_CALL_DECK: RollCallDeckMember[] = buildRollCallMockDeck(14);

export function getDemoRollCallDeck(): RollCallDeckMember[] {
  return DEMO_ROLL_CALL_DECK.map((member) => ({ ...member, mark: member.mark ? { ...member.mark } : null }));
}

function deckMemberToRosterVisitor(member: RollCallDeckMember): ClassRosterVisitor {
  return {
    mindbodyClientId: member.mindbodyClientId,
    name: member.displayName,
    signedInMindbody: member.hasFacilityCheckInToday,
    userId: member.userId,
    checkedInLocally: Boolean(member.mark && member.mark.status !== 'absent'),
  };
}

export function getDemoClassRoster(classId: string): ClassRosterResponse {
  const classItem = getDemoCoachClassById(classId) ?? getDemoCoachClasses()[0]!;
  const deck = getDemoRollCallDeck();

  return {
    classId: classItem.id,
    mindbodyClassId: classItem.mindbodyClassId ?? 'demo-mb',
    title: classItem.title,
    startsAt: classItem.startsAt,
    visitors: deck.map(deckMemberToRosterVisitor),
    cached: false,
  };
}

const DEMO_BELT_REQUIREMENTS: BeltPathSummary['requirements'] = [
  {
    id: 'demo-req-1',
    rankId: 'demo-rank-blue',
    stripe: 3,
    title: 'Attend 40 classes this stripe',
    description: 'Regular mat time at fundamentals and open mat.',
    type: 'attendance',
    attendanceTarget: 40,
    unlockAfterStripe: null,
    status: 'done',
    assessedAt: null,
  },
  {
    id: 'demo-req-2',
    rankId: 'demo-rank-blue',
    stripe: 3,
    title: 'Chain 3 submissions from guard',
    description: 'Armbar → triangle → omoplata flow.',
    type: 'skill',
    attendanceTarget: null,
    unlockAfterStripe: null,
    status: 'now',
    assessedAt: null,
  },
  {
    id: 'demo-req-3',
    rankId: 'demo-rank-blue',
    stripe: 3,
    title: 'Coach assessment — positional sparring',
    description: 'Demonstrate side control escapes under pressure.',
    type: 'assessment',
    attendanceTarget: null,
    unlockAfterStripe: 2,
    status: 'locked',
    assessedAt: null,
  },
];

const demoRequirementStatusByUser = new Map<string, Map<string, BeltRequirementItem['status']>>();

function getDemoRequirementStatusMap(userId: string): Map<string, BeltRequirementItem['status']> {
  let map = demoRequirementStatusByUser.get(userId);
  if (!map) {
    map = new Map();
    demoRequirementStatusByUser.set(userId, map);
  }
  return map;
}

function buildDemoRequirementsForUser(userId: string): BeltRequirementItem[] {
  const overrides = getDemoRequirementStatusMap(userId);

  return DEMO_BELT_REQUIREMENTS.map((req) => {
    const status = overrides.get(req.id) ?? req.status;
    return {
      ...req,
      status,
      assessedAt: status === 'done' ? new Date().toISOString() : null,
    };
  });
}

function syncDemoCandidateFromRequirements(userId: string, requirements: BeltRequirementItem[]): void {
  const candidate = DEMO_PROMOTION_CANDIDATES.find((item) => item.userId === userId);
  if (!candidate) return;

  const activeRequirements = requirements.filter((req) => req.status !== 'locked');
  if (activeRequirements.length === 0) return;

  const doneCount = activeRequirements.filter((req) => req.status === 'done').length;
  candidate.percent = Math.round((doneCount / activeRequirements.length) * 100);
  candidate.candidateReason =
    candidate.percent >= 100
      ? 'ready_for_stripe'
      : candidate.percent >= 80
        ? 'near_ready'
        : 'tracking';
}

export function markDemoRequirementStatus(
  userId: string,
  requirementId: string,
  status: 'now' | 'done',
): void {
  const requirement = DEMO_BELT_REQUIREMENTS.find((req) => req.id === requirementId);
  if (!requirement) {
    throw new Error('Requirement not found.');
  }
  if (requirement.type === 'attendance') {
    throw new Error('Attendance requirements are computed from check-ins.');
  }

  const overrides = getDemoRequirementStatusMap(userId);
  overrides.set(requirementId, status);

  const requirements = buildDemoRequirementsForUser(userId);
  syncDemoCandidateFromRequirements(userId, requirements);
}

export function awardDemoPromotion(userId: string): void {
  const candidate = DEMO_PROMOTION_CANDIDATES.find((item) => item.userId === userId);
  if (!candidate) {
    throw new Error('Member not found.');
  }

  candidate.beltStripes += 1;
  candidate.percent = 24;
  candidate.candidateReason = 'tracking';
  demoRequirementStatusByUser.delete(userId);
}

export function getDemoCoachMemberBeltPath(userId: string): BeltPathSummary {
  const candidate = DEMO_PROMOTION_CANDIDATES.find((item) => item.userId === userId);
  const requirements = buildDemoRequirementsForUser(userId);

  return {
    progress: {
      userId,
      discipline: 'bjj',
      rankId: 'demo-rank-blue',
      rankName: candidate?.beltRank ?? 'Blue Belt',
      stripe: candidate?.beltStripes ?? 3,
      maxStripes: 4,
      percent: candidate?.percent ?? 85,
      trainingDays: candidate?.trainingDays ?? 72,
      updatedAt: new Date().toISOString(),
    },
    requirements,
    promotions: [
      {
        id: 'demo-promo-1',
        discipline: 'bjj',
        fromRankName: 'Blue Belt',
        toRankName: 'Blue Belt',
        fromStripe: 2,
        toStripe: 3,
        awardedAt: new Date(Date.now() - 90 * 24 * 60 * 60_000).toISOString(),
      },
    ],
    curriculumRanks: [
      { id: 'demo-rank-white', discipline: 'bjj', name: 'White', order: 1, stripes: 4 },
      { id: 'demo-rank-blue', discipline: 'bjj', name: 'Blue', order: 2, stripes: 4 },
      { id: 'demo-rank-purple', discipline: 'bjj', name: 'Purple', order: 3, stripes: 4 },
      { id: 'demo-rank-brown', discipline: 'bjj', name: 'Brown', order: 4, stripes: 4 },
      { id: 'demo-rank-black', discipline: 'bjj', name: 'Black', order: 5, stripes: 4 },
    ],
    isPlaceholderCurriculum: false,
  };
}

export function searchDemoCoachMembers(query: string): CoachMemberSearchItem[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  return DEMO_PROMOTION_CANDIDATES.filter(
    (item) =>
      item.fullName.toLowerCase().includes(normalized) ||
      item.email.toLowerCase().includes(normalized),
  ).map((item) => ({
    id: item.userId,
    fullName: item.fullName,
    email: item.email,
    beltRank: item.beltRank,
    beltStripes: item.beltStripes,
  }));
}
