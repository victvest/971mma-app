

export type MembershipTier = 'standard' | 'pro' | 'elite';
export type MembershipStatus = 'active' | 'paused' | 'expired';
export type BookingStatus = 'booked' | 'waitlisted' | 'cancelled' | 'attended';
export type UserRole = 'member' | 'coach' | 'admin' | 'gate';
export type LinkMethod = 'matched_email' | 'matched_phone' | 'created' | 'manual';
export type RequirementType = 'attendance' | 'skill' | 'assessment';
export type RequirementStatus = 'locked' | 'now' | 'done';
export type PointsTier = 'bronze' | 'silver' | 'gold';
export type PointsReason =
  | 'check_in'
  | 'redeem'
  | 'bonus'
  | 'adjustment'
  | 'milestone'
  | 'promotion'
  | 'referral'
  | 'birthday';
export type MilestoneStatus = 'locked' | 'next' | 'earned';
export type RewardCategory = 'cafeteria' | 'gear' | 'coaching' | 'events';
export type RewardFulfillment = 'manual' | 'mindbody';
export type RedemptionStatus = 'pending' | 'fulfilled' | 'cancelled' | 'refunded';
export type CheckInSource = 'supabase' | 'mindbody';

/** Facility visit recording method (`check_ins.method`). */
export type CheckInMethod =
  | 'qr_scan'
  | 'qr_self'
  | 'coach_roster'
  | 'gate_scan'
  | 'mindbody_visit';
export type GuardianLinkStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export type RollCallMemberStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'left_early'
  | 'guest';

export type RollCallMarkMethod =
  | 'roll_call'
  | 'walk_in'
  | 'qr_scan'
  | 'roster_list';

export type RollCallSessionStatus = 'draft' | 'in_progress' | 'completed';

export interface RollCallSessionRow {
  id: string;
  class_id: string;
  coach_id: string;
  status: RollCallSessionStatus;
  deck_cursor: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassSessionAttendanceRow {
  id: string;
  class_id: string;
  user_id: string | null;
  mindbody_client_id: string | null;
  status: RollCallMemberStatus;
  method: RollCallMarkMethod;
  marked_by: string;
  marked_at: string;
  roll_call_session_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  membership_tier: MembershipTier;
  membership_status: MembershipStatus;
  membership_expires_at: string | null;
  membership_name: string | null;
  membership_source: string | null;
  membership_last_synced_at: string | null;
  belt_rank: string | null;
  belt_stripes: number;
  role: UserRole;
  member_since: string | null;
  mindbody_synced_at: string | null;
  date_of_birth: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassRow {
  id: string;
  title: string;
  discipline: string;
  discipline_id: string | null;
  description: string | null;
  coach_name: string | null;
  coach_id: string | null;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  level: string | null;
  image_url: string | null;
  mindbody_class_id: string | null;
  program_id: string | null;
  staff_mindbody_id: string | null;
  booked_count: number;
  is_available: boolean;
  is_waitlist_available: boolean;
  is_cancelled: boolean;
  last_synced_at: string | null;
  created_at: string;
}

export interface BookingRow {
  id: string;
  user_id: string;
  class_id: string;
  status: BookingStatus;
  created_at: string;
}

export interface CheckInRow {
  id: string;
  user_id: string;
  class_id: string | null;
  checked_in_at: string;
  method: CheckInMethod | string;
  mindbody_visit_id: string | null;
  source: CheckInSource;
  signed_in?: boolean;
  missed?: boolean;
  late_cancelled?: boolean;
  raw_payload?: Record<string, unknown> | null;
  gate_jti?: string | null;
  presented_by?: string | null;
  classes?: {
    id: string;
    title: string;
    discipline: string;
    discipline_id?: string | null;
    duration_minutes: number;
    coach_name: string | null;
    coach_id?: string | null;
    disciplines?: {
      slug: string;
      display_name: string;
    } | null;
    coaches?: {
      name: string;
    } | null;
  } | null;
}

export interface GateTokenRow {
  id: string;
  jti: string;
  location_id: string;
  expires_at: string;
  issued_by_user_id: string | null;
  device_label: string | null;
  created_at: string;
}

export interface MindbodyLinkRow {
  user_id: string;
  mindbody_client_id: string;
  mindbody_unique_id: string | null;
  linked_at: string;
  link_method: LinkMethod;
}

export interface ProgramRow {
  id: string;
  mindbody_program_id: string | null;
  name: string;
  discipline: string | null;
  discipline_id: string | null;
  session_type_ids: unknown[];
  active: boolean;
  last_synced_at: string | null;
  created_at: string;
}

export interface CoachRow {
  id: string;
  mindbody_staff_id: string | null;
  name: string;
  specialty: string | null;
  rank: string | null;
  rating: number | null;
  bio: string | null;
  photo_url: string | null;
  is_head_coach: boolean;
  sort_order: number;
  last_synced_at: string | null;
  created_at: string;
}

export interface BeltRankRow {
  id: string;
  discipline: string;
  name: string;
  order: number;
  stripes: number;
  created_at: string;
}

export interface BeltRequirementRow {
  id: string;
  rank_id: string;
  stripe: number;
  title: string;
  description: string | null;
  type: RequirementType;
  attendance_target: number | null;
  unlock_after_stripe: number | null;
  created_at: string;
}

export interface MemberBeltProgressRow {
  user_id: string;
  discipline: string;
  rank_id: string | null;
  stripe: number;
  percent: number;
  updated_at: string;
}

export interface MemberRequirementStatusRow {
  user_id: string;
  requirement_id: string;
  status: RequirementStatus;
  assessed_by: string | null;
  assessed_at: string | null;
  updated_at: string;
}

export interface PromotionRow {
  id: string;
  user_id: string;
  discipline: string;
  from_rank: string | null;
  to_rank: string | null;
  from_stripe: number | null;
  to_stripe: number | null;
  awarded_by: string | null;
  awarded_at: string;
}

export interface PointsAccountRow {
  user_id: string;
  balance: number;
  tier: PointsTier;
  lifetime_points: number;
  updated_at: string;
}

export interface PointsLedgerRow {
  id: string;
  user_id: string;
  delta: number;
  reason: PointsReason;
  ref_id: string | null;
  ref_table?: string | null;
  idempotency_key?: string | null;
  metadata?: Record<string, unknown>;
  balance_after: number;
  created_at: string;
}

export interface MilestoneRow {
  id: string;
  name: string;
  description?: string | null;
  unlock_days: number;
  category: string | null;
  icon: string | null;
  trigger_type?: string;
  config?: Record<string, unknown>;
  points_award?: number;
  hidden?: boolean;
  sort_order?: number;
  active: boolean;
  created_at: string;
}

export interface MemberMilestoneRow {
  user_id: string;
  milestone_id: string;
  status: MilestoneStatus;
  earned_at: string | null;
  updated_at: string;
}

export interface RewardRow {
  id: string;
  name: string;
  category: RewardCategory;
  cost_points: number;
  active: boolean;
  unlock_rule: Record<string, unknown>;
  fulfillment: RewardFulfillment;
  inventory: number | null;
  sort_order: number;
  created_at: string;
}

export interface RedemptionRow {
  id: string;
  user_id: string;
  reward_id: string;
  cost_points: number;
  status: RedemptionStatus;
  fulfilled_at: string | null;
  created_at: string;
  rewards_catalog?: RedemptionRewardRow | RedemptionRewardRow[] | null;
}

export interface RedemptionRewardRow {
  name: string;
  category: RewardCategory;
  fulfillment: RewardFulfillment;
}

export interface QrTokenRow {
  id: string;
  user_id: string;
  jti: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

export interface LineageRow {
  id: string;
  year_label: string;
  name: string;
  role: string | null;
  note: string | null;
  sort_order: number;
  created_at: string;
}

export interface AnnouncementRow {
  id: string;
  author_id: string | null;
  channel: string;
  title: string;
  body: string;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferencesRow {
  user_id: string;
  announcements: boolean;
  class_reminders: boolean;
  milestones: boolean;
  rewards: boolean;
  guardian_alerts: boolean;
  community: boolean;
  updated_at: string;
}

export interface PushTokenRow {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: 'ios' | 'android' | 'web';
  device_id: string | null;
  last_seen_at: string;
  created_at: string;
}

export interface ClassSubscriptionRow {
  id: string;
  user_id: string;
  class_id: string;
  reminder_sent_at: string | null;
  cancellation_notified_at: string | null;
  created_at: string;
}

export interface DisciplineScoreRow {
  user_id: string;
  score: number;
  components: Record<string, unknown>;
  computed_at: string;
}

export interface MemberMembershipRow {
  id: string;
  user_id: string;
  record_kind: 'membership' | 'contract';
  mindbody_record_id: string;
  mindbody_contract_id: string | null;
  mindbody_membership_id: string | null;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  auto_renew: boolean;
  source: 'mindbody';
  last_synced_at: string;
  created_at: string;
}

export interface GuardianLinkRow {
  id: string;
  guardian_user_id: string;
  trainee_user_id: string | null;
  status: GuardianLinkStatus;
  child_display_name: string;
  child_date_of_birth: string | null;
  child_email: string | null;
  child_phone: string | null;
  mindbody_client_id: string | null;
  request_notes: string | null;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  account_mode: 'managed' | 'independent';
  allow_guardian_qr: boolean;
  child_avatar_url: string | null;
}
