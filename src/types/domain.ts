

import type {
  MembershipStatus,
  MembershipTier,
  MilestoneStatus,
  PointsReason,
  PointsTier,
  RedemptionStatus,
  RewardCategory,
  RewardFulfillment,
  RollCallMarkMethod,
  RollCallMemberStatus,
  RollCallSessionStatus,
  ClassSessionAttendanceRow,
  RollCallSessionRow,
  CheckInMethod,
  GateTokenRow,
} from './database';

export type {
  MembershipStatus,
  MembershipTier,
  MilestoneStatus,
  PointsReason,
  PointsTier,
  RedemptionStatus,
  RewardCategory,
  RewardFulfillment,
  RollCallMarkMethod,
  RollCallMemberStatus,
  RollCallSessionStatus,
  ClassSessionAttendanceRow,
  RollCallSessionRow,
  CheckInMethod,
  GateTokenRow,
};

export interface ClassItem {
  id: string;
  title: string;
  discipline: string;
  disciplineId: string | null;
  description: string | null;
  coachName: string;
  coachId: string | null;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  level: string;
  imageUrl: string | null;
  bookedCount: number;
  isAvailable: boolean;
  isWaitlistAvailable: boolean;
  isCancelled: boolean;
  mindbodyClassId: string | null;
  staffMindbodyId: string | null;
}

export interface CoachItem {
  id: string;
  mindbodyStaffId: string | null;
  name: string;
  specialty: string | null;
  rank: string | null;
  rating: number | null;
  bio: string | null;
  photoUrl: string | null;
  isHeadCoach: boolean;
}

export interface MemberProfile {
  id: string;
  fullName: string;
  email?: string | null;
  avatarUrl: string | null;
  phone: string | null;
  membershipTier: MembershipTier;
  membershipStatus: MembershipStatus;
  membershipExpiresAt: string | null;
  membershipName: string | null;
  membershipSource: string | null;
  membershipLastSyncedAt: string | null;
  beltRank: string | null;
  beltStripes: number;
  memberSince: string | null;
  dateOfBirth: string | null;
  onboardingCompletedAt: string | null;
  externalId?: string;
  source: 'supabase' | 'mindbody';
}

export interface Membership {
  tier: MembershipTier;
  status: MembershipStatus;
  expiresAt: string | null;
}

export type MembershipDisplayStatus = MembershipStatus | 'none';

export interface MemberMembershipItem {
  id: string;
  userId: string;
  recordKind: 'membership' | 'contract';
  mindbodyRecordId: string;
  mindbodyContractId: string | null;
  mindbodyMembershipId: string | null;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  autoRenew: boolean;
  source: 'mindbody';
  lastSyncedAt: string;
}

export interface MembershipSummary {
  planName: string | null;
  status: MembershipDisplayStatus;
  expiresAt: string | null;
  autoRenew: boolean;
  source: 'mindbody' | null;
  lastSyncedAt: string | null;
  records: MemberMembershipItem[];
}

export interface CheckInResult {
  id: string;
  classId: string | null;
  checkedInAt: string;
  method: CheckInMethod | string;
  gateJti?: string | null;
}

export interface MemberRef {
  memberId: string;
  source: 'supabase' | 'mindbody';
}

export type ProfilePatch = Partial<
  Pick<MemberProfile, 'fullName' | 'phone' | 'avatarUrl' | 'beltRank' | 'beltStripes' | 'dateOfBirth'>
>;

export type OnboardingInput = {
  fullName: string;
  dateOfBirth: string;
  avatarUrl: string | null;
};

export interface PointsAccount {
  userId: string;
  balance: number;
  tier: PointsTier;
  lifetimePoints: number;
  updatedAt: string | null;
}

export interface PointsLedgerItem {
  id: string;
  delta: number;
  reason: PointsReason;
  refId: string | null;
  refTable: string | null;
  balanceAfter: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface MilestoneItem {
  id: string;
  name: string;
  description: string | null;
  unlockDays: number;
  category: string | null;
  icon: string | null;
  pointsAward: number;
  status: MilestoneStatus;
  earnedAt: string | null;
}

export interface RewardItem {
  id: string;
  name: string;
  category: RewardCategory;
  costPoints: number;
  active: boolean;
  unlockRule: Record<string, unknown>;
  fulfillment: RewardFulfillment;
  inventory: number | null;
  sortOrder: number;
}

export interface RedemptionItem {
  id: string;
  rewardId: string;
  rewardName: string | null;
  rewardCategory: RewardCategory | null;
  rewardFulfillment: RewardFulfillment | null;
  costPoints: number;
  status: RedemptionStatus;
  fulfilledAt: string | null;
  createdAt: string;
}

export interface GuardianLinkItem {
  id: string;
  guardianUserId: string;
  traineeUserId: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  childDisplayName: string;
  childDateOfBirth: string | null;
  childEmail: string | null;
  childPhone: string | null;
  mindbodyClientId: string | null;
  requestNotes: string | null;
  requestedAt: string;
  approvedAt: string | null;
  rejectedReason: string | null;
  accountMode: 'managed' | 'independent';
  allowGuardianQr: boolean;
  childAvatarUrl: string | null;
}

export interface MemberDisciplineEntitlement {
  id: string;
  disciplineId: string;
  slug: string;
  displayName: string;
  hasRankProgression: boolean;
  active: boolean;
  source: 'mindbody_membership' | 'mindbody_contract' | 'admin_override';
  startsOn: string | null;
  endsOn: string | null;
}

export interface RankEligibility {
  eligible: boolean;
  disciplineSlug: string | null;
  disciplineName: string | null;
}

export interface ActiveProfileOption {
  userId: string;
  label: string;
  isSelf: boolean;
  beltRank: string | null;
  avatarUrl: string | null;
}

export interface BeltRankItem {
  id: string;
  discipline: string;
  name: string;
  order: number;
  stripes: number;
}

export interface BeltRequirementItem {
  id: string;
  rankId: string;
  stripe: number;
  title: string;
  description: string | null;
  type: 'attendance' | 'skill' | 'assessment';
  attendanceTarget: number | null;
  unlockAfterStripe: number | null;
  status: 'locked' | 'now' | 'done';
  assessedAt: string | null;
}

export interface BeltProgressItem {
  userId: string;
  discipline: string;
  rankId: string | null;
  rankName: string;
  stripe: number;
  maxStripes: number;
  percent: number;
  trainingDays: number;
  updatedAt: string;
}

export interface PromotionItem {
  id: string;
  discipline: string;
  fromRankName: string | null;
  toRankName: string | null;
  fromStripe: number | null;
  toStripe: number | null;
  awardedAt: string;
}

export interface BeltPathSummary {
  progress: BeltProgressItem;
  requirements: BeltRequirementItem[];
  promotions: PromotionItem[];
  isPlaceholderCurriculum: boolean;
}

export interface CoachMemberSearchItem {
  id: string;
  fullName: string;
  email: string;
  beltRank: string | null;
  beltStripes: number;
}

export interface ClassRosterVisitor {
  mindbodyClientId: string;
  name: string;
  signedInMindbody: boolean;
  userId: string | null;
  checkedInLocally: boolean;
}

export interface ClassRosterResponse {
  classId: string;
  mindbodyClassId: string;
  title: string;
  startsAt: string;
  visitors: ClassRosterVisitor[];
  cached: boolean;
}

export type PromotionCandidateReason = 'ready_for_stripe' | 'near_ready' | 'tracking';

export interface PromotionCandidateItem {
  userId: string;
  fullName: string;
  email: string;
  beltRank: string | null;
  beltStripes: number;
  percent: number;
  trainingDays: number;
  recentCheckIns: number;
  candidateReason: PromotionCandidateReason;
}

export interface CoachDashboardStats {
  todayClassCount: number;
  liveClassCount: number;
  todayCheckIns: number;
  promotionCandidateCount: number;
}

export interface LineageEntryItem {
  id: string;
  yearLabel: string;
  name: string;
  role: string | null;
  note: string | null;
  sortOrder: number;
}

export interface AnnouncementItem {
  id: string;
  authorId: string | null;
  channel: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  announcements: boolean;
  classReminders: boolean;
  milestones: boolean;
  rewards: boolean;
  guardianAlerts: boolean;
  community: boolean;
  updatedAt: string;
}

export interface DisciplineScoreSummary {
  score: number;
  currentStreak: number;
  bestStreak: number;
  trainingDays: number;
  trainingDays30d: number;
  monthlyGoalPct: number;
  computedAt: string | null;
  isPlaceholderWeights: boolean;
  streakStatus?: 'inactive' | 'active' | 'grace' | 'broken';
  lastTrainingDay?: string | null;
  graceUntil?: string | null;
  graceDaysUsed?: number;
}

export interface GymDayActivity {
  date: string;
  trained: boolean;
}
