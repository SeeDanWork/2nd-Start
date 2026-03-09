// ─── Family & Members ───────────────────────────────────────

export enum ParentRole {
  PARENT_A = 'parent_a',
  PARENT_B = 'parent_b',
}

export enum MemberRole {
  PARENT_A = 'parent_a',
  PARENT_B = 'parent_b',
  CAREGIVER = 'caregiver',
  VIEWER = 'viewer',
}

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

export enum FamilyStatus {
  ONBOARDING = 'onboarding',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

export enum WeekendDefinition {
  FRI_SAT = 'fri_sat',
  SAT_SUN = 'sat_sun',
}

// ─── Constraints ────────────────────────────────────────────

export enum ConstraintType {
  LOCKED_NIGHT = 'locked_night',
  MAX_CONSECUTIVE = 'max_consecutive',
  MIN_CONSECUTIVE = 'min_consecutive',
  WEEKEND_SPLIT = 'weekend_split',
  MAX_TRANSITIONS_PER_WEEK = 'max_transitions_per_week',
  DAYCARE_EXCHANGE_ONLY = 'daycare_exchange_only',
  NO_SCHOOL_NIGHT_TRANSITION = 'no_school_night_transition',
  HANDOFF_LOCATION_PREFERENCE = 'handoff_location_preference',
  FAIRNESS_TARGET = 'fairness_target',
  UNAVAILABLE_DAY = 'unavailable_day',
}

export enum ConstraintHardness {
  HARD = 'hard',
  SOFT = 'soft',
}

export enum ConstraintOwner {
  PARENT_A = 'parent_a',
  PARENT_B = 'parent_b',
  SHARED = 'shared',
}

// ─── Handoffs & Locations ───────────────────────────────────

export enum HandoffType {
  DAYCARE_DROPOFF = 'daycare_dropoff',
  DAYCARE_PICKUP = 'daycare_pickup',
  SCHOOL_DROPOFF = 'school_dropoff',
  SCHOOL_PICKUP = 'school_pickup',
  NEUTRAL_EXCHANGE = 'neutral_exchange',
  HOME_EXCHANGE = 'home_exchange',
}

export enum LocationType {
  DAYCARE = 'daycare',
  SCHOOL = 'school',
  NEUTRAL = 'neutral',
  HOME_PARENT_A = 'home_parent_a',
  HOME_PARENT_B = 'home_parent_b',
}

// ─── Requests ───────────────────────────────────────────────

export enum RequestType {
  NEED_COVERAGE = 'need_coverage',
  WANT_TIME = 'want_time',
  BONUS_WEEK = 'bonus_week',
  SWAP_DATE = 'swap_date',
}

export enum RequestStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PROPOSALS_GENERATED = 'proposals_generated',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum RequestUrgency {
  NORMAL = 'normal',
  URGENT = 'urgent',
}

export enum ReasonTag {
  WORK_TRAVEL = 'work_travel',
  MEDICAL = 'medical',
  FAMILY_EVENT = 'family_event',
  OTHER = 'other',
}

// ─── Proposals ──────────────────────────────────────────────

export enum AcceptanceType {
  MANUAL = 'manual',
  AUTO_APPROVED = 'auto_approved',
  COUNTER = 'counter',
}

// ─── Schedules ──────────────────────────────────────────────

export enum SolverStatus {
  OPTIMAL = 'optimal',
  FEASIBLE = 'feasible',
  INFEASIBLE = 'infeasible',
  TIMEOUT = 'timeout',
}

export enum ScheduleSource {
  GENERATION = 'generation',
  PROPOSAL_ACCEPTANCE = 'proposal_acceptance',
  MANUAL_OVERRIDE = 'manual_override',
}

export enum AssignmentSource {
  GENERATED = 'generated',
  PROPOSAL = 'proposal',
  MANUAL = 'manual',
}

// ─── Metrics & Audit ────────────────────────────────────────

export enum LedgerWindowType {
  TWO_WEEK = '2_week',
  FOUR_WEEK = '4_week',
  EIGHT_WEEK = '8_week',
  TWELVE_WEEK = '12_week',
}

export enum AuditAction {
  SCHEDULE_GENERATED = 'schedule_generated',
  SCHEDULE_ACTIVATED = 'schedule_activated',
  REQUEST_CREATED = 'request_created',
  PROPOSAL_GENERATED = 'proposal_generated',
  PROPOSAL_ACCEPTED = 'proposal_accepted',
  PROPOSAL_DECLINED = 'proposal_declined',
  PROPOSAL_EXPIRED = 'proposal_expired',
  PROPOSAL_COUNTERED = 'proposal_countered',
  CONSTRAINT_ADDED = 'constraint_added',
  CONSTRAINT_REMOVED = 'constraint_removed',
  CONSTRAINT_UPDATED = 'constraint_updated',
  CONSENT_RULE_CHANGED = 'consent_rule_changed',
  EMERGENCY_ACTIVATED = 'emergency_activated',
  EMERGENCY_RETURNED = 'emergency_returned',
  MEMBER_INVITED = 'member_invited',
  MEMBER_ACCEPTED = 'member_accepted',
  SHARE_LINK_CREATED = 'share_link_created',
}

export enum AuditEntityType {
  SCHEDULE = 'schedule',
  REQUEST = 'request',
  CONSTRAINT = 'constraint',
  CONSENT_RULE = 'consent_rule',
  EMERGENCY = 'emergency',
  MEMBER = 'member',
  SHARE_LINK = 'share_link',
}

// ─── Sharing ────────────────────────────────────────────────

export enum ShareLinkScope {
  CALENDAR_READONLY = 'calendar_readonly',
  ICS_FEED = 'ics_feed',
  HANDOFF_SCHEDULE = 'handoff_schedule',
}

export enum ShareLinkFormat {
  WEB = 'web',
  ICS = 'ics',
}

// ─── Notifications ──────────────────────────────────────────

export enum NotificationChannel {
  EMAIL = 'email',
  PUSH = 'push',
}

export enum NotificationType {
  HANDOFF_REMINDER = 'handoff_reminder',
  PROPOSAL_RECEIVED = 'proposal_received',
  PROPOSAL_EXPIRING = 'proposal_expiring',
  PROPOSAL_ACCEPTED = 'proposal_accepted',
  PROPOSAL_EXPIRED = 'proposal_expired',
  EMERGENCY_ACTIVATED = 'emergency_activated',
  EMERGENCY_RETURN = 'emergency_return',
  BUDGET_LOW = 'budget_low',
  FAIRNESS_DRIFT = 'fairness_drift',
}

// ─── Living Arrangement ────────────────────────────────────

export enum LivingArrangement {
  SHARED = 'shared',
  PRIMARY_VISITS = 'primary_visits',
  UNDECIDED = 'undecided',
}

// ─── Disruption Overlay ──────────────────────────────────────

export enum DisruptionEventType {
  PUBLIC_HOLIDAY = 'public_holiday',
  SCHOOL_CLOSED = 'school_closed',
  SCHOOL_HALF_DAY = 'school_half_day',
  EMERGENCY_CLOSURE = 'emergency_closure',
  CHILD_SICK = 'child_sick',
  CAREGIVER_SICK = 'caregiver_sick',
  PARENT_TRAVEL = 'parent_travel',
  TRANSPORT_FAILURE = 'transport_failure',
  FAMILY_EVENT = 'family_event',
  CAMP_WEEK = 'camp_week',
  BREAK = 'break',
  SUMMER_PERIOD = 'summer_period',
  OTHER_DECLARED = 'other_declared',
}

export enum DisruptionScope {
  HOUSEHOLD = 'household',
  CHILD_ID = 'child_id',
}

export enum DisruptionSource {
  AUTO_LOCALE = 'auto_locale',
  AUTO_INFERRED = 'auto_inferred',
  USER_DECLARED = 'user_declared',
  LEARNED_POLICY = 'learned_policy',
}

export enum OverrideStrength {
  NONE = 'none',
  LOGISTICS_ONLY = 'logistics_only',
  SOFT = 'soft',
  HARD = 'hard',
}

export enum OverlayActionType {
  NO_OVERRIDE = 'no_override',
  LOGISTICS_FALLBACK = 'logistics_fallback',
  BLOCK_ASSIGNMENT = 'block_assignment',
  DELAY_EXCHANGE = 'delay_exchange',
  GENERATE_PROPOSALS = 'generate_proposals',
}

export enum PolicySource {
  GLOBAL_DEFAULT = 'global_default',
  LEARNED_POLICY = 'learned_policy',
  FAMILY_SPECIFIC = 'family_specific',
}

// ─── Multi-Child Scoring ──────────────────────────────────────

export enum MultiChildScoringMode {
  INDIVIDUAL = 'individual',
  GROUPED = 'grouped',
}

// ─── Guardrails ─────────────────────────────────────────────

export enum ConsentRuleType {
  FAIRNESS_BAND = 'fairness_band',
  MAX_TRANSITIONS = 'max_transitions',
  MAX_STREAK = 'max_streak',
  REQUEST_TYPE = 'request_type',
}

export enum EmergencyModeStatus {
  ACTIVE = 'active',
  RETURNED = 'returned',
  CANCELLED = 'cancelled',
}

// ─── Messaging ──────────────────────────────────────────────

export enum MessagingChannel {
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
}

export enum ConversationState {
  IDLE = 'idle',
  ONBOARDING = 'onboarding',
  REQUESTING = 'requesting',
  RESPONDING = 'responding',
  REPORTING = 'reporting',
  REVIEWING = 'reviewing',
}

export enum MessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum MessageIntent {
  REPORT_ILLNESS = 'report_illness',
  REQUEST_SWAP = 'request_swap',
  CONFIRM_SCHEDULE = 'confirm_schedule',
  REPORT_DISRUPTION = 'report_disruption',
  APPROVE = 'approve',
  DECLINE = 'decline',
  VIEW_SCHEDULE = 'view_schedule',
  HELP = 'help',
  UNKNOWN = 'unknown',
}

export enum DeliveryStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  UNDELIVERED = 'undelivered',
}

// ─── Calendar Sync ──────────────────────────────────────────

export enum CalendarProvider {
  GOOGLE = 'google',
  APPLE = 'apple',
  OUTLOOK = 'outlook',
}

export enum CalendarEventType {
  CUSTODY_BLOCK = 'custody_block',
  EXCHANGE = 'exchange',
  HOLIDAY = 'holiday',
  DISRUPTION = 'disruption',
}

export enum CalendarSyncStatus {
  PENDING = 'pending',
  SYNCED = 'synced',
  FAILED = 'failed',
  STALE = 'stale',
}
