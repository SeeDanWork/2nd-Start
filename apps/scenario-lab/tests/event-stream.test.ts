import { describe, it, expect } from 'vitest';
import { EventStream, createEvent, genEventId } from '../lib/conversation/event-stream';
import { ConversationEvent } from '../lib/conversation/events';

function makeEvent(kind: string, origin: string, payload: Record<string, unknown> = {}): ConversationEvent {
  return createEvent(kind as any, 'session-1', origin as any, payload);
}

describe('EventStream', () => {
  it('starts empty', () => {
    const stream = new EventStream();
    expect(stream.length).toBe(0);
    expect(stream.all()).toEqual([]);
  });

  it('appends events in order', () => {
    const stream = new EventStream();
    const e1 = makeEvent('ParentMessageReceived', 'parent_a', { text: 'hello', phone: '+1' });
    const e2 = makeEvent('SystemAcknowledgment', 'system', { text: 'hi', targetParent: 'parent_a' });

    stream.append(e1);
    stream.append(e2);

    expect(stream.length).toBe(2);
    expect(stream.all()[0].kind).toBe('ParentMessageReceived');
    expect(stream.all()[1].kind).toBe('SystemAcknowledgment');
  });

  it('filters by kind', () => {
    const stream = new EventStream();
    stream.append(makeEvent('ParentMessageReceived', 'parent_a', { text: 'hi', phone: '+1' }));
    stream.append(makeEvent('SystemAcknowledgment', 'system', { text: 'ok', targetParent: 'parent_a' }));
    stream.append(makeEvent('ParentMessageReceived', 'parent_b', { text: 'yo', phone: '+2' }));

    const msgs = stream.byKind('ParentMessageReceived');
    expect(msgs).toHaveLength(2);
  });

  it('filters by origin', () => {
    const stream = new EventStream();
    stream.append(makeEvent('ParentMessageReceived', 'parent_a', { text: 'hi', phone: '+1' }));
    stream.append(makeEvent('SystemAcknowledgment', 'system', { text: 'ok', targetParent: 'parent_a' }));

    expect(stream.byOrigin('parent_a')).toHaveLength(1);
    expect(stream.byOrigin('system')).toHaveLength(1);
    expect(stream.byOrigin('parent_b')).toHaveLength(0);
  });

  it('filters by case', () => {
    const stream = new EventStream();
    const e1 = createEvent('CaseOpened', 'session-1', 'parent_a', { caseType: 'disruption', initiator: 'parent_a', summary: 'sick' }, 'case-1');
    const e2 = makeEvent('ParentMessageReceived', 'parent_a', { text: 'hi', phone: '+1' });

    stream.append(e1);
    stream.append(e2);

    expect(stream.byCase('case-1')).toHaveLength(1);
    expect(stream.byCase('case-1')[0].kind).toBe('CaseOpened');
  });

  it('filters visible events per parent', () => {
    const stream = new EventStream();
    // Parent A message — visible to A only
    stream.append(makeEvent('ParentMessageReceived', 'parent_a', { text: 'hi', phone: '+1' }));
    // System ack to parent A — visible to A only
    stream.append(makeEvent('SystemAcknowledgment', 'system', { text: 'ok', targetParent: 'parent_a' }));
    // Resolution — visible to both
    stream.append(makeEvent('ResolutionApplied', 'system', { resolutionType: 'auto_resolved', summary: 'Done' }));

    const aView = stream.visibleTo('parent_a');
    const bView = stream.visibleTo('parent_b');

    expect(aView.length).toBeGreaterThan(bView.length);
    // Both see resolution
    expect(aView.some(e => e.kind === 'ResolutionApplied')).toBe(true);
    expect(bView.some(e => e.kind === 'ResolutionApplied')).toBe(true);
    // Only A sees the ack
    expect(aView.some(e => e.kind === 'SystemAcknowledgment')).toBe(true);
    expect(bView.some(e => e.kind === 'SystemAcknowledgment')).toBe(false);
  });

  it('gets last event of kind', () => {
    const stream = new EventStream();
    stream.append(makeEvent('ParentMessageReceived', 'parent_a', { text: 'first', phone: '+1' }));
    stream.append(makeEvent('SystemAcknowledgment', 'system', { text: 'ok', targetParent: 'parent_a' }));
    stream.append(makeEvent('ParentMessageReceived', 'parent_b', { text: 'second', phone: '+2' }));

    const last = stream.lastOfKind('ParentMessageReceived');
    expect(last).toBeDefined();
    expect((last as any).payload.text).toBe('second');
  });

  it('returns undefined for missing kind', () => {
    const stream = new EventStream();
    expect(stream.lastOfKind('CaseOpened')).toBeUndefined();
  });

  it('counts events by kind', () => {
    const stream = new EventStream();
    stream.append(makeEvent('ParentMessageReceived', 'parent_a', { text: 'a', phone: '+1' }));
    stream.append(makeEvent('ParentMessageReceived', 'parent_b', { text: 'b', phone: '+2' }));
    stream.append(makeEvent('SystemAcknowledgment', 'system', { text: 'ok', targetParent: 'parent_a' }));

    expect(stream.count('ParentMessageReceived')).toBe(2);
    expect(stream.count('SystemAcknowledgment')).toBe(1);
    expect(stream.count('CaseOpened')).toBe(0);
  });

  it('has() returns correct boolean', () => {
    const stream = new EventStream();
    expect(stream.has('ParentMessageReceived')).toBe(false);
    stream.append(makeEvent('ParentMessageReceived', 'parent_a', { text: 'hi', phone: '+1' }));
    expect(stream.has('ParentMessageReceived')).toBe(true);
  });

  it('last(n) returns last n events', () => {
    const stream = new EventStream();
    for (let i = 0; i < 5; i++) {
      stream.append(makeEvent('ParentMessageReceived', 'parent_a', { text: `msg${i}`, phone: '+1' }));
    }
    expect(stream.last(3)).toHaveLength(3);
    expect((stream.last(3)[0] as any).payload.text).toBe('msg2');
  });

  it('serializes and deserializes', () => {
    const stream = new EventStream();
    stream.append(makeEvent('ParentMessageReceived', 'parent_a', { text: 'hi', phone: '+1' }));
    stream.append(makeEvent('SystemAcknowledgment', 'system', { text: 'ok', targetParent: 'parent_a' }));

    const json = stream.toJSON();
    const restored = EventStream.fromJSON(json);

    expect(restored.length).toBe(2);
    expect(restored.all()[0].kind).toBe('ParentMessageReceived');
  });
});

describe('createEvent', () => {
  it('creates event with correct fields', () => {
    const event = createEvent('ParentMessageReceived', 'session-1', 'parent_a', { text: 'hi', phone: '+1' });
    expect(event.kind).toBe('ParentMessageReceived');
    expect(event.sessionId).toBe('session-1');
    expect(event.origin).toBe('parent_a');
    expect(event.id).toBeTruthy();
    expect(event.timestamp).toBeTruthy();
  });

  it('includes caseId when provided', () => {
    const event = createEvent('CaseOpened', 'session-1', 'parent_a', { caseType: 'disruption', initiator: 'parent_a', summary: 'test' }, 'case-99');
    expect(event.caseId).toBe('case-99');
  });
});

describe('genEventId', () => {
  it('generates unique IDs', () => {
    const a = genEventId();
    const b = genEventId();
    expect(a).not.toBe(b);
    expect(a.length).toBe(16);
  });
});
