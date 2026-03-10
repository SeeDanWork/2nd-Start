import { describe, it, expect } from 'vitest';
import { CalendarConstraintClassifier } from '../classification/CalendarConstraintClassifier';
import { makeNormalizedEvent } from './helpers';

describe('CalendarConstraintClassifier', () => {
  const classifier = new CalendarConstraintClassifier();

  it('classifies child school event as HARD', () => {
    const event = makeNormalizedEvent({
      scopeType: 'CHILD',
      kind: 'SCHOOL',
      childId: 'child-1',
      parentId: undefined,
    });
    const result = classifier.classify({ event });

    expect(result.constraintLevel).toBe('HARD');
    expect(result.classificationReason).toContain('school');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('classifies child activity as STRONG', () => {
    const event = makeNormalizedEvent({
      scopeType: 'CHILD',
      kind: 'ACTIVITY',
      childId: 'child-1',
      parentId: undefined,
    });
    const result = classifier.classify({ event });

    expect(result.constraintLevel).toBe('STRONG');
    expect(result.classificationReason).toContain('activity');
  });

  it('classifies informational event as SOFT', () => {
    const event = makeNormalizedEvent({
      scopeType: 'FAMILY',
      kind: 'INFORMATIONAL',
      parentId: undefined,
      childId: undefined,
    });
    const result = classifier.classify({ event });

    expect(result.constraintLevel).toBe('SOFT');
  });

  it('classification reason and confidence are populated deterministically', () => {
    const event = makeNormalizedEvent({
      scopeType: 'PARENT',
      kind: 'TRAVEL',
    });
    const result1 = classifier.classify({ event });
    const result2 = classifier.classify({ event });

    expect(result1.constraintLevel).toBe(result2.constraintLevel);
    expect(result1.classificationReason).toBe(result2.classificationReason);
    expect(result1.confidence).toBe(result2.confidence);
    expect(result1.classificationReason).toBeTruthy();
    expect(result1.confidence).toBeGreaterThan(0);
  });

  it('classifies parent work as STRONG', () => {
    const event = makeNormalizedEvent({ scopeType: 'PARENT', kind: 'WORK' });
    const result = classifier.classify({ event });
    expect(result.constraintLevel).toBe('STRONG');
  });

  it('classifies child daycare as HARD', () => {
    const event = makeNormalizedEvent({
      scopeType: 'CHILD',
      kind: 'DAYCARE',
      childId: 'child-1',
      parentId: undefined,
    });
    const result = classifier.classify({ event });
    expect(result.constraintLevel).toBe('HARD');
  });

  it('falls back to SOFT for unknown scope/kind combination', () => {
    const event = makeNormalizedEvent({
      scopeType: 'PARENT',
      kind: 'HOLIDAY',
    });
    const result = classifier.classify({ event });
    // PARENT + HOLIDAY has no explicit rule → falls back to SOFT
    expect(result.constraintLevel).toBe('SOFT');
    expect(result.confidence).toBeLessThanOrEqual(0.60);
  });
});
