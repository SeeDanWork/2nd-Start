import { describe, it, expect } from 'vitest';
import { CalendarScopeResolver } from '../core/CalendarScopeResolver';
import { makeExternalEvent, makeFamilyContext, PARENT_A_ID, CHILD_1_ID, CHILD_2_ID } from './helpers';

describe('CalendarScopeResolver', () => {
  const resolver = new CalendarScopeResolver();

  it('resolves parent-scoped event from exact name', () => {
    const event = makeExternalEvent({ title: "Alice's work meeting" });
    const result = resolver.resolveScope({
      event,
      familyContext: makeFamilyContext(),
    });

    expect(result.scopeType).toBe('PARENT');
    expect(result.parentId).toBe(PARENT_A_ID);
  });

  it('resolves child-scoped event from exact name', () => {
    const event = makeExternalEvent({ title: "Charlie's soccer practice" });
    const result = resolver.resolveScope({
      event,
      familyContext: makeFamilyContext(),
    });

    expect(result.scopeType).toBe('CHILD');
    expect(result.childId).toBe(CHILD_1_ID);
  });

  it('returns FAMILY with unresolved tokens when multiple children match', () => {
    const event = makeExternalEvent({ title: 'Charlie and Dana school event' });
    const result = resolver.resolveScope({
      event,
      familyContext: makeFamilyContext(),
    });

    // Both children match but no single child scope is deterministic
    // Parent check runs first, no parent match, child has 2 matches → ambiguous → FAMILY
    expect(result.scopeType).toBe('FAMILY');
    expect(result.unresolvedTokens).toBeDefined();
  });

  it('does not guess unknown entities', () => {
    const event = makeExternalEvent({ title: 'Unknown person event' });
    const result = resolver.resolveScope({
      event,
      familyContext: makeFamilyContext(),
    });

    expect(result.scopeType).toBe('FAMILY');
    expect(result.parentId).toBeUndefined();
    expect(result.childId).toBeUndefined();
  });

  it('resolves scope from metadata parentId', () => {
    const event = makeExternalEvent({
      title: 'Some event',
      metadata: { parentId: PARENT_A_ID },
    });
    const result = resolver.resolveScope({
      event,
      familyContext: makeFamilyContext(),
    });

    expect(result.scopeType).toBe('PARENT');
    expect(result.parentId).toBe(PARENT_A_ID);
  });
});
