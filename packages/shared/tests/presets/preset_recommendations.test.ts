import { describe, it, expect } from 'vitest';
import { computePresetRecommendations, type PresetInput } from '../../src/presets/preset_recommendations';
import { LivingArrangement, DisruptionEventType, OverlayActionType } from '../../src/enums';

function makeInput(overrides: Partial<PresetInput> = {}): PresetInput {
  return {
    locale: 'en-US',
    arrangement: LivingArrangement.SHARED,
    youngestBand: '5-7y',
    childCount: 1,
    commuteMinutes: 15,
    schoolAnchor: true,
    ...overrides,
  };
}

describe('computePresetRecommendations', () => {
  it('returns template ranking from age band', () => {
    const result = computePresetRecommendations(makeInput());
    expect(result.templateRanking.length).toBeGreaterThan(0);
    // School-age default templates should be present
    expect(result.templateRanking).toContain('2255');
  });

  it('primary-visits arrangement prioritizes primary templates', () => {
    const result = computePresetRecommendations(
      makeInput({ arrangement: LivingArrangement.PRIMARY_VISITS }),
    );
    expect(result.templateRanking[0]).toBe('primary_weekends');
    expect(result.reasons.some((r) => r.includes('Primary-visits'))).toBe(true);
  });

  it('long commute prioritizes longer-block templates', () => {
    const result = computePresetRecommendations(
      makeInput({ commuteMinutes: 45 }),
    );
    expect(result.reasons.some((r) => r.includes('commute'))).toBe(true);
  });

  it('always suggests school closure and holiday logistics policies', () => {
    const result = computePresetRecommendations(makeInput());
    const eventTypes = result.suggestedPolicies.map((p) => p.eventType);
    expect(eventTypes).toContain(DisruptionEventType.SCHOOL_CLOSED);
    expect(eventTypes).toContain(DisruptionEventType.PUBLIC_HOLIDAY);
  });

  it('suggests illness delay for young children', () => {
    const result = computePresetRecommendations(
      makeInput({ youngestBand: '0-6m' }),
    );
    const sickPolicy = result.suggestedPolicies.find(
      (p) => p.eventType === DisruptionEventType.CHILD_SICK,
    );
    expect(sickPolicy).toBeDefined();
    expect(sickPolicy!.actionType).toBe(OverlayActionType.DELAY_EXCHANGE);
  });

  it('does NOT suggest illness delay for older children', () => {
    const result = computePresetRecommendations(
      makeInput({ youngestBand: '8-10y' }),
    );
    const sickPolicy = result.suggestedPolicies.find(
      (p) => p.eventType === DisruptionEventType.CHILD_SICK,
    );
    expect(sickPolicy).toBeUndefined();
  });

  it('suggests transport fallback for long commutes', () => {
    const result = computePresetRecommendations(
      makeInput({ commuteMinutes: 40 }),
    );
    const transportPolicy = result.suggestedPolicies.find(
      (p) => p.eventType === DisruptionEventType.TRANSPORT_FAILURE,
    );
    expect(transportPolicy).toBeDefined();
  });

  it('extends prompt lead time for long commute', () => {
    const result = computePresetRecommendations(
      makeInput({ commuteMinutes: 50 }),
    );
    expect(result.promptLeadTimeHours).toBe(48);
  });

  it('extends prompt lead time for infants', () => {
    const result = computePresetRecommendations(
      makeInput({ youngestBand: '0-6m' }),
    );
    expect(result.promptLeadTimeHours).toBeGreaterThanOrEqual(36);
  });

  it('notes multi-child sibling unity', () => {
    const result = computePresetRecommendations(
      makeInput({ childCount: 3 }),
    );
    expect(result.reasons.some((r) => r.includes('siblings'))).toBe(true);
  });

  it('is deterministic', () => {
    const input = makeInput({ commuteMinutes: 40, childCount: 2, youngestBand: '1-2y' });
    const r1 = computePresetRecommendations(input);
    const r2 = computePresetRecommendations(input);
    expect(r1).toEqual(r2);
  });
});
