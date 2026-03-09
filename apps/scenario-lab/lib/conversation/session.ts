// ── Conversation Session ─────────────────────────────────────
// A session represents one family-level conversation thread.
// Both parents participate in the same session, seeing
// parent-specific views of the same underlying event stream.
//
// The session owns:
//  - shared event stream (single source of truth)
//  - case manager (mediation cases)
//  - conversation mode
//  - schedule and config references
//  - who is expected to respond next

import { randomBytes } from 'crypto';
import { EventStream, createEvent } from './event-stream';
import { CaseManager, MediationCase } from './case-manager';
import { ConversationEvent, ConversationEventKind } from './events';
import { ScenarioConfig, ScheduleDay } from '../types';

// ── Conversation Mode ──

export type ConversationMode =
  | 'onboarding'
  | 'operational'
  | 'mediation'
  | 'followup';

// ── Session Model ──

export interface ConversationSession {
  id: string;
  /** Reference to the scenario this session belongs to */
  scenarioId: string;
  /** Family configuration */
  config: ScenarioConfig;
  /** Current conversation mode */
  mode: ConversationMode;
  /** The shared event stream */
  events: EventStream;
  /** Case manager for mediation cases */
  cases: CaseManager;
  /** Who is expected to respond next */
  pendingResponseFrom: 'parent_a' | 'parent_b' | 'system' | null;
  /** Onboarding state for each parent */
  onboarding: {
    parentA: { started: boolean; completed: boolean; answeredTopics: Set<string> };
    parentB: { started: boolean; completed: boolean; answeredTopics: Set<string> };
  };
  /** Current schedule (owned by deterministic engine) */
  schedule: ScheduleDay[];
  /** Current simulation day */
  currentDay: number;
  createdAt: string;
}

// ── Session Factory ──

export function createSession(
  scenarioId: string,
  config: ScenarioConfig,
): ConversationSession {
  return {
    id: randomBytes(8).toString('hex'),
    scenarioId,
    config,
    mode: 'onboarding',
    events: new EventStream(),
    cases: new CaseManager(),
    pendingResponseFrom: null,
    onboarding: {
      parentA: { started: false, completed: false, answeredTopics: new Set() },
      parentB: { started: false, completed: false, answeredTopics: new Set() },
    },
    schedule: [],
    currentDay: 0,
    createdAt: new Date().toISOString(),
  };
}

// ── Session Helpers ──

/** Emit an event into the session's event stream. */
export function emitEvent(
  session: ConversationSession,
  kind: ConversationEventKind,
  origin: 'parent_a' | 'parent_b' | 'system',
  payload: Record<string, unknown>,
  caseId?: string,
): ConversationEvent {
  const event = createEvent(kind, session.id, origin, payload, caseId);
  session.events.append(event);

  // Link to case if specified
  if (caseId) {
    session.cases.addRelatedEvent(caseId, event.id);
  }

  return event;
}

/** Open a mediation case and emit the CaseOpened event. */
export function openCase(
  session: ConversationSession,
  type: MediationCase['type'],
  initiator: MediationCase['initiator'],
  summary: string,
  structuredRequest?: Record<string, unknown>,
): MediationCase {
  const mediationCase = session.cases.openCase(
    session.id,
    type,
    initiator,
    summary,
    structuredRequest,
  );

  emitEvent(session, 'CaseOpened', initiator, {
    caseType: type,
    initiator,
    summary,
  }, mediationCase.id);

  return mediationCase;
}

/** Get the active case the system is mediating, if any. */
export function getActiveCase(session: ConversationSession): MediationCase | null {
  return session.cases.getActiveCase(session.id);
}

/** Determine who should respond next. */
export function getExpectedResponder(
  session: ConversationSession,
): 'parent_a' | 'parent_b' | 'system' | null {
  // Check active case first
  const activeCase = getActiveCase(session);
  if (activeCase?.pendingResponseFrom) {
    return activeCase.pendingResponseFrom;
  }

  // During onboarding
  if (session.mode === 'onboarding') {
    if (!session.onboarding.parentA.completed) return 'parent_a';
    if (!session.onboarding.parentB.completed) return 'parent_b';
    return 'system'; // Ready to generate schedule
  }

  return session.pendingResponseFrom;
}

/** Check if a parent has completed onboarding. */
export function isParentOnboarded(
  session: ConversationSession,
  parent: 'parent_a' | 'parent_b',
): boolean {
  return parent === 'parent_a'
    ? session.onboarding.parentA.completed
    : session.onboarding.parentB.completed;
}

/** Mark a parent's onboarding as complete. */
export function completeOnboarding(
  session: ConversationSession,
  parent: 'parent_a' | 'parent_b',
): void {
  if (parent === 'parent_a') {
    session.onboarding.parentA.completed = true;
  } else {
    session.onboarding.parentB.completed = true;
  }

  emitEvent(session, 'OnboardingComplete', parent, {
    parent,
    scheduleGenerated: session.schedule.length > 0,
  });

  // If both complete, transition to operational
  if (session.onboarding.parentA.completed && session.onboarding.parentB.completed) {
    session.mode = 'operational';
  }
}

/** Transition session to mediation mode. */
export function enterMediation(session: ConversationSession): void {
  session.mode = 'mediation';
}

/** Return to operational mode. */
export function exitMediation(session: ConversationSession): void {
  session.mode = session.cases.getActiveCases(session.id).length > 0
    ? 'mediation'
    : 'operational';
}

/** Get the most recent parent message. */
export function getLastParentMessage(
  session: ConversationSession,
  parent: 'parent_a' | 'parent_b',
): ConversationEvent | undefined {
  return session.events.lastFromParent(parent);
}

/** Get a summary of session state for LLM context. */
export function getSessionContext(session: ConversationSession): Record<string, unknown> {
  const activeCase = getActiveCase(session);
  const recentEvents = session.events.last(10);

  return {
    mode: session.mode,
    pendingResponseFrom: getExpectedResponder(session),
    activeCaseId: activeCase?.id || null,
    activeCaseType: activeCase?.type || null,
    activeCaseStatus: activeCase?.status || null,
    scheduleExists: session.schedule.length > 0,
    currentDay: session.currentDay,
    onboardingA: session.onboarding.parentA.completed,
    onboardingB: session.onboarding.parentB.completed,
    recentEventKinds: recentEvents.map(e => e.kind),
    totalEvents: session.events.length,
    activeCaseCount: session.cases.getActiveCases(session.id).length,
    childNames: session.config.children.map(c => c.name),
    parentALabel: session.config.parentA.label,
    parentBLabel: session.config.parentB.label,
  };
}
