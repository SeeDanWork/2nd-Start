// ── Event Stream ─────────────────────────────────────────────
// Append-only ordered event log for a conversation session.
// All parent views derive from querying this stream.
//
// The stream is the single source of truth for what happened.
// No message arrays — events produce transcripts via view-builder.

import { randomBytes } from 'crypto';
import {
  ConversationEvent,
  ConversationEventKind,
  ConversationEventBase,
  getEventVisibility,
} from './events';

// ── Event Stream ──

export class EventStream {
  private events: ConversationEvent[] = [];

  get length(): number {
    return this.events.length;
  }

  /** Append an event. Returns the event with a generated ID if missing. */
  append(event: ConversationEvent): ConversationEvent {
    if (!event.id) {
      (event as any).id = genEventId();
    }
    if (!event.timestamp) {
      (event as any).timestamp = new Date().toISOString();
    }
    this.events.push(event);
    return event;
  }

  /** Get all events in order. */
  all(): readonly ConversationEvent[] {
    return this.events;
  }

  /** Get events by kind. */
  byKind<K extends ConversationEventKind>(
    kind: K,
  ): ConversationEvent[] {
    return this.events.filter(e => e.kind === kind);
  }

  /** Get events for a specific case. */
  byCase(caseId: string): ConversationEvent[] {
    return this.events.filter(e => e.caseId === caseId);
  }

  /** Get events from a specific origin. */
  byOrigin(origin: 'parent_a' | 'parent_b' | 'system'): ConversationEvent[] {
    return this.events.filter(e => e.origin === origin);
  }

  /** Get events visible to a specific parent. */
  visibleTo(parent: 'parent_a' | 'parent_b'): ConversationEvent[] {
    return this.events.filter(e => {
      const vis = getEventVisibility(e);
      return parent === 'parent_a' ? vis.parentA : vis.parentB;
    });
  }

  /** Get the last event of a specific kind. */
  lastOfKind(kind: ConversationEventKind): ConversationEvent | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) {
      if (this.events[i].kind === kind) return this.events[i];
    }
    return undefined;
  }

  /** Get the last N events. */
  last(n: number): ConversationEvent[] {
    return this.events.slice(-n);
  }

  /** Get events after a specific timestamp. */
  after(timestamp: string): ConversationEvent[] {
    return this.events.filter(e => e.timestamp > timestamp);
  }

  /** Check if a kind of event has occurred. */
  has(kind: ConversationEventKind): boolean {
    return this.events.some(e => e.kind === kind);
  }

  /** Count events of a specific kind. */
  count(kind: ConversationEventKind): number {
    return this.events.filter(e => e.kind === kind).length;
  }

  /** Get the last event from a parent. */
  lastFromParent(parent: 'parent_a' | 'parent_b'): ConversationEvent | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) {
      if (this.events[i].origin === parent) return this.events[i];
    }
    return undefined;
  }

  /** Serialize to plain array (for API responses). */
  toJSON(): ConversationEvent[] {
    return [...this.events];
  }

  /** Restore from serialized array. */
  static fromJSON(data: ConversationEvent[]): EventStream {
    const stream = new EventStream();
    stream.events = [...data];
    return stream;
  }
}

// ── Event Factory ──

export function genEventId(): string {
  return randomBytes(8).toString('hex');
}

/** Create an event with defaults filled in. */
export function createEvent<K extends ConversationEventKind>(
  kind: K,
  sessionId: string,
  origin: ConversationEventBase['origin'],
  payload: Record<string, unknown>,
  caseId?: string,
): ConversationEvent {
  return {
    id: genEventId(),
    kind,
    timestamp: new Date().toISOString(),
    origin,
    sessionId,
    caseId,
    payload,
  } as unknown as ConversationEvent;
}
