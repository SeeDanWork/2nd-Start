// ─── Fairness Defaults ──────────────────────────────────────

export const DEFAULT_FAIRNESS_BAND = {
  maxOvernightDelta: 1,
  windowWeeks: 8,
} as const;

export const DEFAULT_WEEKEND_TARGET_PCT = 50;
export const DEFAULT_WEEKEND_TOLERANCE_PCT = 10;

// ─── Change Budget ──────────────────────────────────────────

export const DEFAULT_CHANGE_BUDGET_PER_MONTH = 4;

// ─── Solver ─────────────────────────────────────────────────

export const SOLVER_TIMEOUT_SECONDS = 30;
export const SOLVER_MAX_SOLUTIONS = 10;
export const SOLVER_MIN_HAMMING_DISTANCE = 2;
export const DEFAULT_PROPOSAL_HORIZON_WEEKS = 8;
export const DEFAULT_SCHEDULE_HORIZON_WEEKS = 12;

// ─── Solver Weights (soft constraint penalties) ─────────────

export const DEFAULT_SOLVER_WEIGHTS = {
  fairnessDeviation: 100,
  totalTransitions: 50,
  nonDaycareHandoffs: 30,
  weekendFragmentation: 40,
  schoolNightDisruption: 60,
} as const;

// ─── Proposals ──────────────────────────────────────────────

export const DEFAULT_PROPOSAL_EXPIRY_HOURS = 48;
export const URGENT_PROPOSAL_EXPIRY_HOURS = 12;
export const PROPOSAL_EXPIRY_WARNING_HOURS = 4;
export const MAX_PROPOSALS_RETURNED = 5;
export const MAX_COUNTER_DEPTH = 1;

// ─── Constraints ────────────────────────────────────────────

export const DEFAULT_MAX_CONSECUTIVE_NIGHTS = 5;
export const BONUS_WEEK_MAX_CONSECUTIVE = 7;
export const DEFAULT_MAX_TRANSITIONS_PER_WEEK = 3;
export const MIN_CONSTRAINT_WEIGHT = 1;
export const MAX_CONSTRAINT_WEIGHT = 1000;

// ─── Requests ───────────────────────────────────────────────

export const MAX_REASON_NOTE_LENGTH = 200;

// ─── Auth ───────────────────────────────────────────────────

export const MAGIC_LINK_TTL_MINUTES = 15;
export const INVITE_TOKEN_TTL_DAYS = 7;
export const MAGIC_LINK_RATE_LIMIT_PER_HOUR = 5;
export const JWT_ACCESS_TOKEN_TTL = '5h';
export const JWT_REFRESH_TOKEN_TTL = '30d';

// ─── Rate Limits ────────────────────────────────────────────

export const RATE_LIMITS = {
  magicLinkPerEmailPerHour: 5,
  authVerifyPerToken: 10,
  scheduleGenerationPerFamilyPerHour: 3,
  proposalGenerationPerFamilyPerHour: 5,
  generalApiPerUserPerMinute: 100,
} as const;

// ─── Notifications ──────────────────────────────────────────

export const DEFAULT_REMINDER_HOURS_BEFORE = 24;

// ─── Sharing ────────────────────────────────────────────────

export const SHARE_LINK_TOKEN_BYTES = 32;

// ─── Offline Cache ──────────────────────────────────────────

export const CACHE_HORIZON_WEEKS = 12;
export const CACHE_STALE_THRESHOLD_HOURS = 1;

// ─── Account Deletion ───────────────────────────────────────

export const ACCOUNT_DELETION_GRACE_DAYS = 30;
