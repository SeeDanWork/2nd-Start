import { z } from 'zod';
import {
  ParentRole,
  MemberRole,
  WeekendDefinition,
  ConstraintType,
  ConstraintHardness,
  ConstraintOwner,
  LocationType,
  RequestType,
  RequestUrgency,
  ReasonTag,
  ConsentRuleType,
  ShareLinkScope,
  ShareLinkFormat,
} from './enums';
import {
  MAX_REASON_NOTE_LENGTH,
  MIN_CONSTRAINT_WEIGHT,
  MAX_CONSTRAINT_WEIGHT,
} from './constants';

// ─── Helpers ────────────────────────────────────────────────

const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeString = z.string().regex(/^\d{2}:\d{2}$/);
const uuidString = z.string().uuid();

// ─── Auth ───────────────────────────────────────────────────

export const sendMagicLinkSchema = z.object({
  email: z.string().email().max(255),
});

export const verifyMagicLinkSchema = z.object({
  token: z.string().min(1),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).optional(),
  notificationPreferences: z
    .object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      reminderHoursBefore: z.number().int().min(1).max(72).optional(),
    })
    .optional(),
});

// ─── Family ─────────────────────────────────────────────────

export const createFamilySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1),
});

export const updateFamilySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).optional(),
  weekendDefinition: z.nativeEnum(WeekendDefinition).optional(),
  fairnessBand: z
    .object({
      maxOvernightDelta: z.number().int().min(0).max(5),
      windowWeeks: z.number().int().min(2).max(16),
    })
    .optional(),
  changeBudget: z
    .object({
      maxPerMonth: z.number().int().min(1).max(20),
    })
    .optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email().max(255),
  role: z.nativeEnum(MemberRole),
  label: z.string().min(1).max(50),
});

// ─── Children ───────────────────────────────────────────────

export const createChildSchema = z.object({
  firstName: z.string().min(1).max(50),
  dateOfBirth: isoDateString.optional(),
  schoolName: z.string().max(100).optional(),
});

export const updateChildSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  dateOfBirth: isoDateString.optional().nullable(),
  schoolName: z.string().max(100).optional().nullable(),
});

// ─── Constraints ────────────────────────────────────────────

const lockedNightParams = z.object({
  parent: z.nativeEnum(ParentRole),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
});

const maxConsecutiveParams = z.object({
  parent: z.nativeEnum(ParentRole),
  maxNights: z.number().int().min(1).max(14),
});

const minConsecutiveParams = z.object({
  parent: z.nativeEnum(ParentRole),
  minNights: z.number().int().min(1).max(7),
});

const weekendSplitParams = z.object({
  targetPctParentA: z.number().int().min(0).max(100),
  tolerancePct: z.number().int().min(0).max(50),
});

const maxTransitionsParams = z.object({
  perWeek: z.number().int().min(1).max(7),
});

const daycareExchangeOnlyParams = z.object({
  enabled: z.boolean(),
});

const noSchoolNightTransitionParams = z.object({
  enabled: z.boolean(),
});

const handoffLocationPreferenceParams = z.object({
  preferredLocationId: uuidString,
});

export const constraintParametersSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(ConstraintType.LOCKED_NIGHT), ...lockedNightParams.shape }),
  z.object({ type: z.literal(ConstraintType.MAX_CONSECUTIVE), ...maxConsecutiveParams.shape }),
  z.object({ type: z.literal(ConstraintType.MIN_CONSECUTIVE), ...minConsecutiveParams.shape }),
  z.object({ type: z.literal(ConstraintType.WEEKEND_SPLIT), ...weekendSplitParams.shape }),
  z.object({ type: z.literal(ConstraintType.MAX_TRANSITIONS_PER_WEEK), ...maxTransitionsParams.shape }),
  z.object({ type: z.literal(ConstraintType.DAYCARE_EXCHANGE_ONLY), ...daycareExchangeOnlyParams.shape }),
  z.object({ type: z.literal(ConstraintType.NO_SCHOOL_NIGHT_TRANSITION), ...noSchoolNightTransitionParams.shape }),
  z.object({ type: z.literal(ConstraintType.HANDOFF_LOCATION_PREFERENCE), ...handoffLocationPreferenceParams.shape }),
]);

export const addConstraintSchema = z.object({
  type: z.nativeEnum(ConstraintType),
  hardness: z.nativeEnum(ConstraintHardness).default(ConstraintHardness.HARD),
  weight: z.number().int().min(MIN_CONSTRAINT_WEIGHT).max(MAX_CONSTRAINT_WEIGHT).default(100),
  owner: z.nativeEnum(ConstraintOwner),
  recurrence: z
    .object({
      daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
      parent: z.nativeEnum(ParentRole),
    })
    .optional(),
  dateRange: z
    .object({
      start: isoDateString,
      end: isoDateString,
    })
    .optional(),
  parameters: z.record(z.unknown()),
});

export const updateConstraintSchema = addConstraintSchema.partial();

// ─── Holidays ───────────────────────────────────────────────

export const holidayEntrySchema = z.object({
  date: isoDateString,
  label: z.string().min(1).max(100),
  daycareClosed: z.boolean().default(false),
});

export const createHolidayCalendarSchema = z.object({
  name: z.string().min(1).max(100),
  entries: z.array(holidayEntrySchema).min(1),
});

export const updateHolidayCalendarSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  entries: z.array(holidayEntrySchema).optional(),
});

// ─── Handoff Locations ──────────────────────────────────────

const availableWindowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  start: timeString,
  end: timeString,
});

export const createLocationSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(LocationType),
  address: z.string().max(300).optional(),
  isDefault: z.boolean().default(false),
  availableWindows: z.array(availableWindowSchema).optional(),
});

export const updateLocationSchema = createLocationSchema.partial();

// ─── Requests ───────────────────────────────────────────────

export const createRequestSchema = z.object({
  type: z.nativeEnum(RequestType),
  dates: z.array(isoDateString).min(1).max(31),
  reasonTag: z.nativeEnum(ReasonTag).optional(),
  reasonNote: z.string().max(MAX_REASON_NOTE_LENGTH).optional(),
  urgency: z.nativeEnum(RequestUrgency).default(RequestUrgency.NORMAL),
});

// ─── Change Request (Interpreter) ──────────────────────────
export const changeRequestSchema = z.object({
  type: z.nativeEnum(RequestType),
  dates: z.array(isoDateString).min(1).max(31),
  reasonTag: z.nativeEnum(ReasonTag).optional(),
  reasonNote: z.string().max(MAX_REASON_NOTE_LENGTH).optional(),
  urgency: z.nativeEnum(RequestUrgency).default(RequestUrgency.NORMAL),
  childScope: z.array(uuidString).optional(),
  disruptionEventId: uuidString.optional(),
  isEmergency: z.boolean().default(false),
});

export const updateRequestSchema = z.object({
  dates: z.array(isoDateString).min(1).max(31).optional(),
  reasonTag: z.nativeEnum(ReasonTag).optional().nullable(),
  reasonNote: z.string().max(MAX_REASON_NOTE_LENGTH).optional().nullable(),
  urgency: z.nativeEnum(RequestUrgency).optional(),
});

// ─── Proposals ──────────────────────────────────────────────

export const acceptProposalSchema = z.object({
  expectedVersion: z.number().int().min(1),
});

// ─── Consent Rules ──────────────────────────────────────────

export const createConsentRuleSchema = z.object({
  ruleType: z.nativeEnum(ConsentRuleType),
  threshold: z.record(z.unknown()),
});

export const updateConsentRuleSchema = z.object({
  threshold: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

// ─── Emergency Mode ─────────────────────────────────────────

export const activateEmergencySchema = z.object({
  returnToBaselineAt: isoDateString,
  relaxedConstraintIds: z.array(uuidString).min(1),
});

export const updateEmergencySchema = z.object({
  returnToBaselineAt: isoDateString,
});

// ─── Sharing ────────────────────────────────────────────────

export const createShareLinkSchema = z.object({
  scope: z.nativeEnum(ShareLinkScope),
  label: z.string().max(100).optional(),
  format: z.nativeEnum(ShareLinkFormat).default(ShareLinkFormat.WEB),
  expiresAt: z.string().datetime().optional(),
});

// ─── Schedule Generation ────────────────────────────────────

export const generateScheduleSchema = z.object({
  horizonWeeks: z.number().int().min(4).max(52).default(12),
});

export const generateProposalsSchema = z.object({
  horizonWeeks: z.number().int().min(4).max(16).default(8),
  maxSolutions: z.number().int().min(1).max(10).default(5),
});

// ─── Manual Schedule (dev tool) ─────────────────────────────

export const manualAssignmentSchema = z.object({
  date: isoDateString,
  assignedTo: z.nativeEnum(ParentRole),
});

export const createManualScheduleSchema = z.object({
  assignments: z.array(manualAssignmentSchema).min(1),
});

// ─── Mediation Feedback ────────────────────────────────────

export const submitFeedbackSchema = z.object({
  feedbacks: z.array(
    z.object({
      category: z.enum(['fairness', 'transitions', 'inconvenience', 'routine', 'timing']),
      severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      freeText: z.string().max(500).optional(),
    }),
  ).min(1).max(10),
  requestId: uuidString.optional(),
  optionId: uuidString.optional(),
});

export const fileObjectionSchema = z.object({
  feedbacks: z.array(
    z.object({
      category: z.enum(['fairness', 'transitions', 'inconvenience', 'routine', 'timing']),
      severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      freeText: z.string().max(500).optional(),
    }),
  ).min(1).max(10),
  declinedOptionIds: z.array(uuidString).min(1),
});

// ─── Query Params ───────────────────────────────────────────

export const dateRangeQuerySchema = z.object({
  start: isoDateString,
  end: isoDateString,
});

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ledgerQuerySchema = z.object({
  windows: z.string().default('2,4,8,12'),
});
