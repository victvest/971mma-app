/**
 * Coach Roll Call — domain vocabulary (Phase 1).
 *
 * Status rules (frozen for Phases 2–18):
 * - `late` counts toward session headcount the same as `present` unless academy config
 *   `late_counts_as_present` is false (default: true).
 * - `absent` never creates or updates `check_ins` (facility visit rows).
 * - Summary UI label for `late` is always **Present (late)** — not a separate “absent” bucket.
 * - `guest` and walk-ins with no app account earn no points (see P6).
 */

// ---------------------------------------------------------------------------
// Core enums
// ---------------------------------------------------------------------------

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

export type RollCallScenarioId =
  | 'R1'
  | 'R2'
  | 'R3'
  | 'R4'
  | 'R5'
  | 'P1'
  | 'P2'
  | 'P3'
  | 'P4'
  | 'P5'
  | 'P6'
  | 'P7'
  | 'P8'
  | 'P9'
  | 'F1'
  | 'F2'
  | 'F3'
  | 'F4'
  | 'L1'
  | 'L2'
  | 'L3'
  | 'L4'
  | 'L5'
  | 'L6'
  | 'L7'
  | 'L8'
  | 'L9'
  | 'X1'
  | 'X2'
  | 'X3'
  | 'X4'
  | 'X5'
  | 'M1'
  | 'M2'
  | 'M3';

export type RollCallScenarioSection =
  | 'registration'
  | 'presence'
  | 'facility'
  | 'lifecycle'
  | 'reliability'
  | 'member';

/** Per-scenario mapping — status/method null when the scenario is UI/lifecycle-only. */
export interface RollCallScenarioSpec {
  id: RollCallScenarioId;
  section: RollCallScenarioSection;
  status: RollCallMemberStatus | null;
  method: RollCallMarkMethod | null;
  notes: string;
}

// ---------------------------------------------------------------------------
// Marks & deck members (merged roster + attendance)
// ---------------------------------------------------------------------------

export interface RollCallMarkMetadata {
  /** F3: coach marked absent but member has facility check-in today */
  attendance_mismatch?: boolean;
  /** F4: guardian QR at entry */
  presented_by?: string | null;
  /** Phase 15 — optional coach note when marking left early */
  left_early_note?: string | null;
  /** X1: offline queue dedupe */
  client_generated_id?: string;
  audit_note?: string;
  [key: string]: unknown;
}

export interface RollCallMemberMark {
  id: string;
  status: RollCallMemberStatus;
  method: RollCallMarkMethod;
  markedAt: string;
  markedBy: string;
  metadata: RollCallMarkMetadata;
}

/** Merged Mindbody roster row + optional existing mark + display fields. */
export interface RollCallDeckMember {
  /** Stable deck key: `userId` or `mb:${mindbodyClientId}` */
  deckKey: string;
  displayName: string;
  avatarUrl: string | null;
  beltRank: string | null;
  beltStripes: number;
  userId: string | null;
  mindbodyClientId: string;
  mark: RollCallMemberMark | null;
  /** R1/R2 — linked Supabase profile */
  isOnApp: boolean;
  /** R1 — on Mindbody class roster */
  isBookedOnRoster: boolean;
  /** F1 — `check_ins` row exists for gym day */
  hasFacilityCheckInToday: boolean;
  /** P5 — added via walk-in search, not on initial roster */
  isWalkIn: boolean;
  /** P6 — guest / manual name-only */
  isGuest: boolean;
  /** F4 — guardian presented QR at entry */
  presentedBy: string | null;
}

export interface RollCallSummary {
  present: number;
  late: number;
  absent: number;
  leftEarly: number;
  walkIns: number;
  guests: number;
  notOnApp: number;
  /** Headcount: present + late when `lateCountsAsPresent` (default true) */
  sessionCount: number;
  totalMarked: number;
  totalOnDeck: number;
}

export interface RollCallSessionView {
  id: string;
  classId: string;
  coachId: string;
  status: RollCallSessionStatus;
  deckCursor: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface RollCallState {
  session: RollCallSessionView | null;
  classId: string;
  classTitle: string;
  startsAt: string;
  deck: RollCallDeckMember[];
  summary: RollCallSummary;
  rosterCachedAt: string | null;
  config: RollCallConfig;
  /** Full Mindbody roster attendance before roll-call deck filtering. */
  rosterAttendance: { checkedIn: number; missing: number };
}

// ---------------------------------------------------------------------------
// RPC / API contracts (frozen — implemented Phase 3+)
// ---------------------------------------------------------------------------

export interface StartRollCallRequest {
  classId: string;
}

export interface StartRollCallResponse {
  session: RollCallSessionView;
  resumed: boolean;
}

export interface RecordRollCallMarkRequest {
  classId: string;
  userId: string | null;
  mindbodyClientId: string | null;
  status: RollCallMemberStatus;
  method: RollCallMarkMethod;
  metadata?: RollCallMarkMetadata;
}

export type RecordRollCallMarkInput = Omit<RecordRollCallMarkRequest, 'classId'>;

export interface RecordRollCallMarkResponse {
  mark: RollCallMemberMark;
  session: RollCallSessionView;
}

export interface CompleteRollCallRequest {
  sessionId: string;
}

export interface CompleteRollCallResponse {
  session: RollCallSessionView;
  summary: RollCallSummary;
}

export interface AbandonRollCallRequest {
  sessionId: string;
}

export interface AbandonRollCallResponse {
  classId: string;
}

export interface GetRollCallStateRequest {
  classId: string;
}

export type GetRollCallStateResponse = RollCallState;

export interface SearchRollCallMemberRequest {
  classId: string;
  query: string;
  limit?: number;
}

export interface RollCallSearchResult {
  deckKey: string;
  displayName: string;
  avatarUrl: string | null;
  beltRank: string | null;
  beltStripes: number;
  userId: string | null;
  mindbodyClientId: string | null;
  isOnApp: boolean;
  alreadyOnDeck: boolean;
}

export interface SearchRollCallMemberResponse {
  results: RollCallSearchResult[];
}

export interface RollCallConfig {
  /** Default false for pilot — F2 optional bridge to `check_ins` */
  autoFacilityCheckinOnPresent: boolean;
  /** Default true — late ⊆ session headcount */
  lateCountsAsPresent: boolean;
  /** Default true — M1 in-app notification on present/late mark */
  notifyMemberOnPresent: boolean;
  /** Default false — M2 no absent shame notification unless academy opts in */
  notifyMemberOnAbsent: boolean;
}

export const DEFAULT_ROLL_CALL_CONFIG: RollCallConfig = {
  autoFacilityCheckinOnPresent: false,
  lateCountsAsPresent: true,
  notifyMemberOnPresent: true,
  notifyMemberOnAbsent: false,
};

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

export function countsAsPresentForSession(
  status: RollCallMemberStatus,
  config: Pick<RollCallConfig, 'lateCountsAsPresent'> = DEFAULT_ROLL_CALL_CONFIG,
): boolean {
  if (status === 'present') return true;
  if (status === 'late') return config.lateCountsAsPresent;
  return false;
}

/** Summary row / chip label — `late` → "Present (late)" per product agreement. */
export function rollCallStatusDisplayLabel(status: RollCallMemberStatus): string {
  switch (status) {
    case 'present':
      return 'Present';
    case 'late':
      return 'Present (late)';
    case 'absent':
      return 'Absent';
    case 'left_early':
      return 'Left early';
    case 'guest':
      return 'Guest';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function buildRollCallDeckKey(
  userId: string | null,
  mindbodyClientId: string,
): string {
  return userId ?? `mb:${mindbodyClientId}`;
}

export function computeRollCallSummary(
  marks: ReadonlyArray<Pick<RollCallMemberMark, 'status' | 'method'>>,
  deck: ReadonlyArray<Pick<RollCallDeckMember, 'isOnApp' | 'isWalkIn'>>,
  config: Pick<RollCallConfig, 'lateCountsAsPresent'> = DEFAULT_ROLL_CALL_CONFIG,
): RollCallSummary {
  let present = 0;
  let late = 0;
  let absent = 0;
  let leftEarly = 0;
  let walkIns = 0;
  let guests = 0;

  for (const mark of marks) {
    switch (mark.status) {
      case 'present':
        present += 1;
        break;
      case 'late':
        late += 1;
        break;
      case 'absent':
        absent += 1;
        break;
      case 'left_early':
        leftEarly += 1;
        break;
      case 'guest':
        guests += 1;
        break;
      default: {
        const _exhaustive: never = mark.status;
        void _exhaustive;
      }
    }
    if (mark.method === 'walk_in') {
      walkIns += 1;
    }
  }

  const notOnApp = deck.filter((m) => !m.isOnApp).length;
  const sessionCount =
    present + (config.lateCountsAsPresent ? late : 0);

  return {
    present,
    late,
    absent,
    leftEarly,
    walkIns,
    guests,
    notOnApp,
    sessionCount,
    totalMarked: marks.length,
    totalOnDeck: deck.length,
  };
}

/**
 * Scenario matrix (TINDER.md §1) — every ID mapped to status + method where applicable.
 * Lifecycle / read-only scenarios use null status/method.
 */
export const ROLL_CALL_SCENARIOS: readonly RollCallScenarioSpec[] = [
  // §1.1 Registration & roster
  {
    id: 'R1',
    section: 'registration',
    status: null,
    method: null,
    notes: 'Booked + app linked; swipe uses roll_call → present|absent|late',
  },
  {
    id: 'R2',
    section: 'registration',
    status: null,
    method: 'roll_call',
    notes: 'No userId; mark by mindbody_client_id; no points',
  },
  {
    id: 'R3',
    section: 'registration',
    status: null,
    method: null,
    notes: 'Empty roster; walk-in path P5/P6',
  },
  {
    id: 'R4',
    section: 'registration',
    status: null,
    method: null,
    notes: 'Stale roster refresh on deck open',
  },
  {
    id: 'R5',
    section: 'registration',
    status: null,
    method: null,
    notes: 'Wrong class — exit confirm; no partial save unless confirmed',
  },
  // §1.2 Presence
  { id: 'P1', section: 'presence', status: 'present', method: 'roll_call', notes: 'Swipe right' },
  { id: 'P2', section: 'presence', status: 'absent', method: 'roll_call', notes: 'Swipe left' },
  { id: 'P3', section: 'presence', status: 'late', method: 'roll_call', notes: 'Add late from summary/search' },
  {
    id: 'P4',
    section: 'presence',
    status: 'late',
    method: 'roll_call',
    notes: 'Present (late); counts as present for session stats',
  },
  { id: 'P5', section: 'presence', status: 'present', method: 'walk_in', notes: 'Walk-in search → add → swipe' },
  { id: 'P6', section: 'presence', status: 'guest', method: 'walk_in', notes: 'Guest / name-only; no points' },
  { id: 'P7', section: 'presence', status: null, method: null, notes: 'Undo reverts mark; no stored status' },
  {
    id: 'P8',
    section: 'presence',
    status: null,
    method: 'roll_call',
    notes: 'Summary edit — any status via roll_call or roster_list',
  },
  { id: 'P9', section: 'presence', status: 'absent', method: 'roll_call', notes: 'Bulk mark remaining absent' },
  // §1.3 Facility cross-over (read-only hints; marks unchanged)
  { id: 'F1', section: 'facility', status: null, method: null, notes: 'Chip: At academy today' },
  {
    id: 'F2',
    section: 'facility',
    status: 'present',
    method: 'roll_call',
    notes: 'Class-only chip; optional auto_facility_checkin_on_present (off)',
  },
  {
    id: 'F3',
    section: 'facility',
    status: 'absent',
    method: 'roll_call',
    notes: 'Allowed; metadata.attendance_mismatch',
  },
  { id: 'F4', section: 'facility', status: null, method: null, notes: 'presented_by in metadata/chip' },
  // §1.4 Session lifecycle
  { id: 'L1', section: 'lifecycle', status: null, method: null, notes: 'start_roll_call → in_progress' },
  { id: 'L2', section: 'lifecycle', status: null, method: null, notes: 'Exit confirm; save deck_cursor' },
  { id: 'L3', section: 'lifecycle', status: null, method: null, notes: 'Resume unswiped cards first' },
  { id: 'L4', section: 'lifecycle', status: null, method: null, notes: 'complete_roll_call → completed' },
  { id: 'L5', section: 'lifecycle', status: null, method: null, notes: 'Partial deck + bulk absent summary' },
  { id: 'L6', section: 'lifecycle', status: null, method: null, notes: 'Separate attendance per class_id' },
  { id: 'L7', section: 'lifecycle', status: null, method: null, notes: 'Cancelled class — roll call disabled' },
  { id: 'L8', section: 'lifecycle', status: null, method: null, notes: 'Early banner only' },
  { id: 'L9', section: 'lifecycle', status: 'left_early', method: 'roll_call', notes: 'Post-class correction' },
  // §1.5 Reliability
  { id: 'X1', section: 'reliability', status: null, method: 'roll_call', notes: 'Offline queue; same status on flush' },
  { id: 'X2', section: 'reliability', status: null, method: 'roll_call', notes: 'Idempotent upsert per member+class' },
  { id: 'X3', section: 'reliability', status: null, method: 'roll_call', notes: 'Concurrent coaches; last write + audit' },
  { id: 'X4', section: 'reliability', status: null, method: null, notes: 'Coach route guard' },
  { id: 'X5', section: 'reliability', status: null, method: 'roll_call', notes: 'Network fail → card returns to deck' },
  // §1.6 Member-facing (later)
  { id: 'M1', section: 'member', status: 'present', method: 'roll_call', notes: 'Optional notification Phase 16' },
  { id: 'M2', section: 'member', status: 'absent', method: 'roll_call', notes: 'No auto push by default' },
  { id: 'M3', section: 'member', status: null, method: null, notes: 'Member reads own rows via RLS' },
] as const;

export function getRollCallScenario(id: RollCallScenarioId): RollCallScenarioSpec {
  const spec = ROLL_CALL_SCENARIOS.find((s) => s.id === id);
  if (!spec) {
    throw new Error(`Unknown roll call scenario: ${id}`);
  }
  return spec;
}
