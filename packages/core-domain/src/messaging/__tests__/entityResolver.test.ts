import { describe, it, expect } from 'vitest';
import { EntityReferenceResolver } from '../resolution/EntityReferenceResolver';
import { IntentType, ValidatedIntentCandidate } from '../types';
import { makeMessage, makeFamilyContext, PARENT_A_ID, PARENT_B_ID, CHILD_1_ID, CHILD_2_ID } from './helpers';

describe('EntityReferenceResolver', () => {
  const resolver = new EntityReferenceResolver();

  it('resolves exact parent name match from message text', () => {
    const message = makeMessage({ text: 'Can Alice take the kids?' });
    const candidate: ValidatedIntentCandidate = {
      type: IntentType.SWAP_REQUEST,
      payload: { targetDate: '2026-03-15' },
      confidence: 0.9,
      validationPassed: true,
    };

    const result = resolver.resolveEntities({
      message,
      candidate,
      familyContext: makeFamilyContext(),
    });

    expect(result.resolved.parentIds).toContain(PARENT_A_ID);
  });

  it('resolves exact child name match from message text', () => {
    const message = makeMessage({ text: 'Charlie is sick today' });
    const candidate: ValidatedIntentCandidate = {
      type: IntentType.DISRUPTION_REPORT,
      payload: { date: '2026-03-09', disruptionType: 'ILLNESS' },
      confidence: 0.95,
      validationPassed: true,
    };

    const result = resolver.resolveEntities({
      message,
      candidate,
      familyContext: makeFamilyContext(),
    });

    expect(result.resolved.childIds).toContain(CHILD_1_ID);
  });

  it('resolves multiple children mentioned in text', () => {
    const message = makeMessage({ text: 'Both Charlie and Dana need to stay home' });
    const candidate: ValidatedIntentCandidate = {
      type: IntentType.DISRUPTION_REPORT,
      payload: { date: '2026-03-09', disruptionType: 'ILLNESS' },
      confidence: 0.9,
      validationPassed: true,
    };

    const result = resolver.resolveEntities({
      message,
      candidate,
      familyContext: makeFamilyContext(),
    });

    expect(result.resolved.childIds).toContain(CHILD_1_ID);
    expect(result.resolved.childIds).toContain(CHILD_2_ID);
  });

  it('returns ambiguity on payload parent reference matching multiple names', () => {
    // Two parents with the same name
    const context = makeFamilyContext({
      parents: [
        { id: 'p1', name: 'Alex', role: 'MOTHER' },
        { id: 'p2', name: 'Alex', role: 'FATHER' },
      ],
    });

    const candidate: ValidatedIntentCandidate = {
      type: IntentType.SWAP_REQUEST,
      payload: { targetDate: '2026-03-15', requestedWithParentId: 'Alex' },
      confidence: 0.9,
      validationPassed: true,
    };

    const result = resolver.resolveEntities({
      message: makeMessage(),
      candidate,
      familyContext: context,
    });

    expect(result.ambiguities.some(a => a.code === 'AMBIGUOUS_PARENT_REFERENCE')).toBe(true);
  });

  it('does not guess unknown entities', () => {
    const candidate: ValidatedIntentCandidate = {
      type: IntentType.SWAP_REQUEST,
      payload: { targetDate: '2026-03-15', requestedWithParentId: 'UnknownPerson' },
      confidence: 0.9,
      validationPassed: true,
    };

    const result = resolver.resolveEntities({
      message: makeMessage({ text: 'I want to swap with UnknownPerson' }),
      candidate,
      familyContext: makeFamilyContext(),
    });

    expect(result.resolved.unresolvedTokens).toContain('UnknownPerson');
  });
});
