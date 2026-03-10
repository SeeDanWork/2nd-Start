// ── Scope and Classification ──

export type CalendarEventScopeType = 'PARENT' | 'CHILD' | 'FAMILY';

export type CalendarEventKind =
  | 'WORK'
  | 'TRAVEL'
  | 'SCHOOL'
  | 'ACTIVITY'
  | 'DAYCARE'
  | 'HOLIDAY'
  | 'CLOSURE'
  | 'MEDICAL'
  | 'INFORMATIONAL'
  | 'OTHER';

export type CalendarConstraintLevel = 'HARD' | 'STRONG' | 'SOFT';

// ── External Calendar Event ──

export interface ExternalCalendarEvent {
  externalId: string;
  source: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  allDay?: boolean;
  metadata?: Record<string, unknown>;
}

// ── Normalized Calendar Event ──

export interface NormalizedCalendarEvent {
  externalId: string;
  source: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  timezone: string;
  allDay: boolean;
  scopeType: CalendarEventScopeType;
  parentId?: string;
  childId?: string;
  familyId: string;
  kind: CalendarEventKind;
  metadata?: Record<string, unknown>;
}

// ── Classified Calendar Event ──

export interface ClassifiedCalendarEvent extends NormalizedCalendarEvent {
  constraintLevel: CalendarConstraintLevel;
  classificationReason: string;
  confidence: number;
}

// ── Constraint Record ──

export interface CalendarConstraintRecord {
  eventId: string;
  familyId: string;
  scopeType: CalendarEventScopeType;
  parentId?: string;
  childId?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  constraintLevel: CalendarConstraintLevel;
  kind: CalendarEventKind;
  title: string;
  source: string;
  metadata?: Record<string, unknown>;
}

// ── Availability View ──

export interface CalendarAvailabilityView {
  familyId: string;
  windowStart: string;
  windowEnd: string;
  parentConstraints: Record<string, CalendarConstraintRecord[]>;
  childConstraints: Record<string, CalendarConstraintRecord[]>;
  familyConstraints: CalendarConstraintRecord[];
}

// ── Translation Result ──

export interface CalendarTranslationResult {
  familyId: string;
  windowStart: string;
  windowEnd: string;
  constraints: CalendarConstraintRecord[];
  availabilityView: CalendarAvailabilityView;
  artifacts: CalendarArtifact[];
}

// ── Artifact ──

export interface CalendarArtifact {
  type: string;
  data: Record<string, unknown>;
}

// ── Projection Input ──

export interface CalendarProjectionInput {
  familyId: string;
  windowStart: string;
  windowEnd: string;
  parentIds: string[];
  childIds: string[];
  events: ClassifiedCalendarEvent[];
}

// ── Family Context ──

export interface CalendarFamilyContext {
  familyId: string;
  parents: Array<{ id: string; name: string }>;
  children: Array<{ id: string; name: string }>;
  timezone?: string;
}

// ── Ingestion Result ──

export interface CalendarIngestionResult {
  inserted: number;
  updated: number;
  skipped: number;
  events: ClassifiedCalendarEvent[];
}

// ── Persistence Record ──

export interface CalendarEventRecord {
  id: string;
  familyId: string;
  parentId?: string | null;
  childId?: string | null;
  title: string;
  startTime: string;
  endTime: string;
  constraintLevel: CalendarConstraintLevel;
  source: string;
  externalId?: string | null;
  description?: string | null;
  scopeType?: string | null;
  kind?: string | null;
  classificationReason?: string | null;
  classificationConfidence?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt?: string | null;
}
