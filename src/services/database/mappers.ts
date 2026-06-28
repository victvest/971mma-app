import type {
  ClassRow,
  CoachRow,
  PointsAccountRow,
  PointsLedgerRow,
  RedemptionRow,
  RedemptionRewardRow,
  RewardRow,
  ProfileRow,
} from '@/types/database';
import type {
  ClassItem,
  CoachItem,
  MemberProfile,
  PointsAccount,
  PointsLedgerItem,
  RedemptionItem,
  RewardItem,
} from '@/types/domain';

export function mapClassRow(row: ClassRow): ClassItem {
  return {
    id: row.id,
    title: row.title,
    discipline: row.discipline,
    disciplineId: row.discipline_id,
    description: row.description,
    coachName: row.coach_name ?? 'Coach',
    coachId: row.coach_id,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    capacity: row.capacity,
    level: row.level ?? 'All Levels',
    imageUrl: row.image_url,
    bookedCount: row.booked_count,
    isAvailable: row.is_available,
    isWaitlistAvailable: row.is_waitlist_available,
    isCancelled: row.is_cancelled,
    mindbodyClassId: row.mindbody_class_id,
    staffMindbodyId: row.staff_mindbody_id,
  };
}

export function mapCoachRow(row: CoachRow): CoachItem {
  return {
    id: row.id,
    mindbodyStaffId: row.mindbody_staff_id,
    name: row.name,
    specialty: row.specialty,
    rank: row.rank,
    rating: row.rating === null ? null : Number(row.rating),
    bio: row.bio,
    photoUrl: row.photo_url,
    isHeadCoach: row.is_head_coach,
  };
}

export function mapProfileRow(row: ProfileRow, email?: string | null): MemberProfile {
  return {
    id: row.id,
    fullName: row.full_name ?? '',
    email: email ?? null,
    avatarUrl: row.avatar_url,
    phone: row.phone,
    membershipTier: row.membership_tier,
    membershipStatus: row.membership_status,
    membershipExpiresAt: row.membership_expires_at,
    membershipName: row.membership_name,
    membershipSource: row.membership_source,
    membershipLastSyncedAt: row.membership_last_synced_at,
    beltRank: row.belt_rank,
    beltStripes: row.belt_stripes ?? 0,
    memberSince: row.member_since,
    dateOfBirth: row.date_of_birth,
    onboardingCompletedAt: row.onboarding_completed_at,
    externalId: row.id,
    source: 'supabase',
  };
}

export function mapPointsAccountRow(row: PointsAccountRow): PointsAccount {
  return {
    userId: row.user_id,
    balance: row.balance,
    tier: row.tier,
    lifetimePoints: row.lifetime_points,
    updatedAt: row.updated_at,
  };
}

export function mapPointsLedgerRow(row: PointsLedgerRow): PointsLedgerItem {
  return {
    id: row.id,
    delta: row.delta,
    reason: row.reason,
    refId: row.ref_id,
    refTable: row.ref_table ?? null,
    balanceAfter: row.balance_after,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export function mapRewardRow(row: RewardRow): RewardItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    costPoints: row.cost_points,
    active: row.active,
    unlockRule: row.unlock_rule,
    fulfillment: row.fulfillment,
    inventory: row.inventory,
    sortOrder: row.sort_order,
  };
}

export function mapRedemptionRow(row: RedemptionRow): RedemptionItem {
  const reward = joinedRedemptionReward(row.rewards_catalog);

  return {
    id: row.id,
    rewardId: row.reward_id,
    rewardName: reward?.name ?? null,
    rewardCategory: reward?.category ?? null,
    rewardFulfillment: reward?.fulfillment ?? null,
    costPoints: row.cost_points,
    status: row.status,
    fulfilledAt: row.fulfilled_at,
    createdAt: row.created_at,
  };
}

function joinedRedemptionReward(
  reward: RedemptionRewardRow | RedemptionRewardRow[] | null | undefined,
): RedemptionRewardRow | null {
  return Array.isArray(reward) ? (reward[0] ?? null) : (reward ?? null);
}
