// ── View Builder ─────────────────────────────────────────────
// Renders parent-specific transcript views from the shared
// event stream. Both phones display the same events,
// rendered differently per parent.
//
// The view builder produces TranscriptEntry objects that the
// UI renders as message bubbles, cards, or status chips.

import { ConversationEvent, getEventVisibility, ConversationEventKind } from './events';
import { ConversationSession } from './session';
import { ScenarioConfig } from '../types';

// ── Rendered Message Types ──

export type MessageKind =
  | 'parent_text'
  | 'system_ack'
  | 'system_question'
  | 'structured_choice'
  | 'proposal_bundle'
  | 'proposal_resolution'
  | 'calculation_trace'
  | 'fairness_snapshot'
  | 'followup_check'
  | 'case_status'
  | 'day_summary'
  | 'schedule_created'
  | 'onboarding_step';

export interface TranscriptEntry {
  id: string;
  kind: MessageKind;
  from: 'user' | 'system';
  text: string;
  timestamp: string;
  /** The underlying event ID */
  eventId: string;
  /** The underlying event kind */
  eventKind: ConversationEventKind;
  /** Case ID if part of a mediation case */
  caseId?: string;
  /** Structured choices for the parent to select from */
  choices?: Array<{ id: string; label: string }>;
  /** Metadata for rendering (proposal details, fairness data, etc.) */
  metadata?: Record<string, unknown>;
}

// ── View Builder ──

/** Build a full transcript for a specific parent from the event stream. */
export function buildTranscript(
  session: ConversationSession,
  parent: 'parent_a' | 'parent_b',
): TranscriptEntry[] {
  const config = session.config;
  const entries: TranscriptEntry[] = [];

  for (const event of session.events.all()) {
    const vis = getEventVisibility(event);
    const isVisible = parent === 'parent_a' ? vis.parentA : vis.parentB;
    if (!isVisible) continue;

    const rendered = renderEvent(event, parent, config);
    if (rendered) {
      entries.push(rendered);
    }
  }

  return entries;
}

/** Render a single event for a specific parent. Returns null if not renderable. */
function renderEvent(
  event: ConversationEvent,
  parent: 'parent_a' | 'parent_b',
  config: ScenarioConfig,
): TranscriptEntry | null {
  const otherParent = parent === 'parent_a' ? 'parent_b' : 'parent_a';
  const myLabel = parent === 'parent_a' ? config.parentA.label : config.parentB.label;
  const otherLabel = otherParent === 'parent_a' ? config.parentA.label : config.parentB.label;
  const childNames = config.children.map(c => c.name).join(' & ');

  const base = {
    id: event.id,
    eventId: event.id,
    eventKind: event.kind,
    timestamp: event.timestamp,
    caseId: event.caseId,
  };

  switch (event.kind) {
    // ── Parent message ──
    case 'ParentMessageReceived': {
      const isMe = event.origin === parent;
      return {
        ...base,
        kind: 'parent_text',
        from: isMe ? 'user' : 'system',
        text: isMe
          ? event.payload.text
          : `${otherLabel}: ${event.payload.text}`,
      };
    }

    // ── System acknowledgment ──
    case 'SystemAcknowledgment':
      return {
        ...base,
        kind: 'system_ack',
        from: 'system',
        text: event.payload.text,
      };

    // ── System question ──
    case 'SystemQuestion':
      return {
        ...base,
        kind: event.payload.choices ? 'structured_choice' : 'system_question',
        from: 'system',
        text: event.payload.text,
        choices: event.payload.choices || undefined,
      };

    // ── Clarification ──
    case 'ClarificationRequested':
      return {
        ...base,
        kind: 'system_question',
        from: 'system',
        text: event.payload.question,
      };

    case 'ClarificationAnswered':
      return {
        ...base,
        kind: 'parent_text',
        from: 'user',
        text: event.payload.answer,
      };

    // ── Coverage request ──
    case 'CoverageRequestCreated': {
      const isReporter = event.payload.reporter === parent;
      if (isReporter) {
        return {
          ...base,
          kind: 'case_status',
          from: 'system',
          text: `Coverage request sent to ${otherLabel}. Waiting for response.`,
        };
      }
      return null; // Other parent gets CoverageRequestSent instead
    }

    case 'CoverageRequestSent': {
      return {
        ...base,
        kind: 'structured_choice',
        from: 'system',
        text: event.payload.summary as string,
        choices: [
          { id: 'accept', label: 'Accept' },
          { id: 'view_options', label: 'View options' },
          { id: 'decline', label: 'Decline' },
        ],
      };
    }

    // ── Duration estimate ──
    case 'DurationEstimateProvided':
      return {
        ...base,
        kind: 'parent_text',
        from: event.origin === parent ? 'user' : 'system',
        text: formatDuration(event.payload.duration as string),
      };

    // ── Proposals ──
    case 'ProposalBundleGenerated': {
      // For the parent who needs to choose
      return null; // Rendered via ProposalBundleDelivered
    }

    case 'ProposalBundleDelivered':
      return {
        ...base,
        kind: 'proposal_bundle',
        from: 'system',
        text: 'Schedule options generated. Please select an option:',
        metadata: { bundleId: event.payload.bundleId },
      };

    case 'ProposalOptionSelected': {
      const isSelector = event.payload.selectedBy === parent;
      return {
        ...base,
        kind: isSelector ? 'parent_text' : 'case_status',
        from: isSelector ? 'user' : 'system',
        text: isSelector
          ? `Selected: ${event.payload.optionLabel}`
          : `${otherLabel} selected: ${event.payload.optionLabel}`,
      };
    }

    case 'ProposalDeclined': {
      const isDecliner = event.payload.declinedBy === parent;
      return {
        ...base,
        kind: isDecliner ? 'parent_text' : 'case_status',
        from: isDecliner ? 'user' : 'system',
        text: isDecliner
          ? 'Declined all options.'
          : `${otherLabel} declined the proposed options.`,
      };
    }

    // ── Resolution ──
    case 'ResolutionApplied':
      return {
        ...base,
        kind: 'calculation_trace',
        from: 'system',
        text: event.payload.summary as string,
        metadata: event.payload.fairnessSnapshot
          ? { fairness: event.payload.fairnessSnapshot }
          : undefined,
      };

    case 'ScheduleUpdated':
      return {
        ...base,
        kind: 'schedule_created',
        from: 'system',
        text: `Schedule updated: ${event.payload.reason}. ${event.payload.daysAffected} days affected.`,
      };

    // ── Objection / Feedback ──
    case 'StructuredObjectionRecorded': {
      const isAuthor = event.origin === parent;
      if (isAuthor) {
        return {
          ...base,
          kind: 'parent_text',
          from: 'user',
          text: event.payload.description as string,
        };
      }
      return {
        ...base,
        kind: 'case_status',
        from: 'system',
        text: `${otherLabel} raised a concern: ${event.payload.objectionType}.`,
      };
    }

    case 'FeedbackRecorded':
      return {
        ...base,
        kind: 'parent_text',
        from: event.origin === parent ? 'user' : 'system',
        text: event.payload.text as string,
      };

    // ── Follow-up ──
    case 'FollowupScheduled':
      return {
        ...base,
        kind: 'followup_check',
        from: 'system',
        text: event.payload.question as string,
        choices: [
          { id: 'resume', label: 'Yes, resume normal schedule' },
          { id: 'extend', label: 'Not yet, extend coverage' },
        ],
      };

    case 'FollowupCompleted': {
      const outcomes: Record<string, string> = {
        resume_normal: 'Normal schedule resumed.',
        extend_coverage: 'Coverage extended.',
        escalate: 'Escalated for further review.',
      };
      return {
        ...base,
        kind: 'case_status',
        from: 'system',
        text: outcomes[event.payload.outcome as string] || 'Follow-up completed.',
      };
    }

    // ── Case lifecycle ──
    case 'CaseOpened':
      return {
        ...base,
        kind: 'case_status',
        from: 'system',
        text: event.payload.summary as string,
      };

    case 'CaseClosed':
      return {
        ...base,
        kind: 'case_status',
        from: 'system',
        text: `Resolved: ${event.payload.resolution}`,
      };

    // ── Onboarding ──
    case 'OnboardingStepCompleted':
      return null; // Internal tracking, not rendered

    case 'OnboardingComplete': {
      const isMe = event.payload.parent === parent;
      if (isMe) {
        return {
          ...base,
          kind: 'schedule_created',
          from: 'system',
          text: "Your family schedule is now created! You can view your upcoming exchanges by typing 'schedule'. Type 'help' for available commands.",
        };
      }
      return {
        ...base,
        kind: 'schedule_created',
        from: 'system',
        text: `${otherLabel} has completed setup. Your family schedule is now created! You can view your upcoming exchanges by typing 'schedule'.`,
      };
    }

    // ── Operational ──
    case 'DaySummaryGenerated': {
      const text = parent === 'parent_a'
        ? event.payload.textForA
        : event.payload.textForB;
      return {
        ...base,
        kind: 'day_summary',
        from: 'system',
        text: text as string,
      };
    }

    case 'FairnessAlertTriggered':
      return {
        ...base,
        kind: 'fairness_snapshot',
        from: 'system',
        text: event.payload.text as string,
        metadata: {
          parentANights: event.payload.parentANights,
          parentBNights: event.payload.parentBNights,
          drift: event.payload.drift,
        },
      };

    case 'WeeklyOverviewGenerated':
      return {
        ...base,
        kind: 'calculation_trace',
        from: 'system',
        text: event.payload.text as string,
      };

    default:
      return null;
  }
}

// ── Helpers ──

function formatDuration(d: string): string {
  const labels: Record<string, string> = {
    today_only: 'Today only',
    '2_3_days': '2-3 days',
    week: 'About a week',
    unknown: 'Not sure yet',
  };
  return labels[d] || d;
}

/** Convert TranscriptEntry[] to the legacy Message[] format for backward compat. */
export function transcriptToLegacyMessages(
  entries: TranscriptEntry[],
  phone: string,
): Array<{ id: string; from: 'user' | 'system'; text: string; timestamp: string; phone: string }> {
  return entries.map(e => ({
    id: e.id,
    from: e.from,
    text: e.text,
    timestamp: e.timestamp,
    phone,
  }));
}
