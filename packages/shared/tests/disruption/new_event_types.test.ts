import { describe, it, expect } from 'vitest';
import {
  DEFAULT_POLICIES,
  getDefaultPolicy,
} from '../../src/disruption/default_policies';
import {
  DISRUPTION_CATEGORIES,
  type DisruptionCategory,
} from '../../src/disruption/types';
import {
  DisruptionEventType,
  OverlayActionType,
  OverrideStrength,
} from '../../src/enums';

// ─── New Event Type Policy Correctness ────────────────────────────────

describe('Phase 1: New disruption event type policies', () => {
  it('WORK_SHIFT_CHANGE → BLOCK_ASSIGNMENT / HARD', () => {
    const p = getDefaultPolicy(DisruptionEventType.WORK_SHIFT_CHANGE);
    expect(p.actionType).toBe(OverlayActionType.BLOCK_ASSIGNMENT);
    expect(p.defaultStrength).toBe(OverrideStrength.HARD);
    expect(p.fairnessAccounting.createCompensatory).toBe(true);
  });

  it('EMERGENCY_WORK_CALL → DELAY_EXCHANGE / SOFT', () => {
    const p = getDefaultPolicy(DisruptionEventType.EMERGENCY_WORK_CALL);
    expect(p.actionType).toBe(OverlayActionType.DELAY_EXCHANGE);
    expect(p.defaultStrength).toBe(OverrideStrength.SOFT);
    expect(p.fairnessAccounting.createCompensatory).toBe(true);
  });

  it('HOSPITALIZATION → BLOCK_ASSIGNMENT / HARD', () => {
    const p = getDefaultPolicy(DisruptionEventType.HOSPITALIZATION);
    expect(p.actionType).toBe(OverlayActionType.BLOCK_ASSIGNMENT);
    expect(p.defaultStrength).toBe(OverrideStrength.HARD);
    expect(p.fairnessAccounting.createCompensatory).toBe(true);
  });

  it('SCHOOL_TRIP → BLOCK_ASSIGNMENT / HARD', () => {
    const p = getDefaultPolicy(DisruptionEventType.SCHOOL_TRIP);
    expect(p.actionType).toBe(OverlayActionType.BLOCK_ASSIGNMENT);
    expect(p.defaultStrength).toBe(OverrideStrength.HARD);
    expect(p.fairnessAccounting.createCompensatory).toBe(true);
  });

  it('HOLIDAY_TRAVEL → GENERATE_PROPOSALS / SOFT', () => {
    const p = getDefaultPolicy(DisruptionEventType.HOLIDAY_TRAVEL);
    expect(p.actionType).toBe(OverlayActionType.GENERATE_PROPOSALS);
    expect(p.defaultStrength).toBe(OverrideStrength.SOFT);
    expect(p.fairnessAccounting.createCompensatory).toBe(true);
  });

  it('WEATHER_EMERGENCY → LOGISTICS_FALLBACK / SOFT', () => {
    const p = getDefaultPolicy(DisruptionEventType.WEATHER_EMERGENCY);
    expect(p.actionType).toBe(OverlayActionType.LOGISTICS_FALLBACK);
    expect(p.defaultStrength).toBe(OverrideStrength.SOFT);
  });

  it('FLIGHT_DELAY → DELAY_EXCHANGE / SOFT', () => {
    const p = getDefaultPolicy(DisruptionEventType.FLIGHT_DELAY);
    expect(p.actionType).toBe(OverlayActionType.DELAY_EXCHANGE);
    expect(p.defaultStrength).toBe(OverrideStrength.SOFT);
    expect(p.fairnessAccounting.createCompensatory).toBe(true);
  });

  it('FUNERAL → BLOCK_ASSIGNMENT / HARD', () => {
    const p = getDefaultPolicy(DisruptionEventType.FUNERAL);
    expect(p.actionType).toBe(OverlayActionType.BLOCK_ASSIGNMENT);
    expect(p.defaultStrength).toBe(OverrideStrength.HARD);
    expect(p.fairnessAccounting.createCompensatory).toBe(true);
  });

  it('POWER_OUTAGE → LOGISTICS_FALLBACK / LOGISTICS_ONLY', () => {
    const p = getDefaultPolicy(DisruptionEventType.POWER_OUTAGE);
    expect(p.actionType).toBe(OverlayActionType.LOGISTICS_FALLBACK);
    expect(p.defaultStrength).toBe(OverrideStrength.LOGISTICS_ONLY);
    expect(p.fairnessAccounting.countsTowardFairness).toBe(true);
  });

  it('HOME_REPAIR → LOGISTICS_FALLBACK / LOGISTICS_ONLY', () => {
    const p = getDefaultPolicy(DisruptionEventType.HOME_REPAIR);
    expect(p.actionType).toBe(OverlayActionType.LOGISTICS_FALLBACK);
    expect(p.defaultStrength).toBe(OverrideStrength.LOGISTICS_ONLY);
    expect(p.fairnessAccounting.countsTowardFairness).toBe(true);
  });
});

// ─── Full Coverage ────────────────────────────────────────────────────

describe('All 23 event types have policies', () => {
  const allTypes = Object.values(DisruptionEventType);

  it('DEFAULT_POLICIES has exactly 23 entries', () => {
    expect(DEFAULT_POLICIES).toHaveLength(23);
  });

  it.each(allTypes)('%s has a default policy', (eventType) => {
    const policy = getDefaultPolicy(eventType);
    expect(policy.eventType).toBe(eventType);
    // Must not be the unknown fallback for a known type
    expect(policy.description).not.toBe('Unknown event: no automatic override');
  });

  it('no duplicate event types in DEFAULT_POLICIES', () => {
    const types = DEFAULT_POLICIES.map((p) => p.eventType);
    expect(new Set(types).size).toBe(types.length);
  });
});

// ─── Disruption Categories ────────────────────────────────────────────

describe('DISRUPTION_CATEGORIES', () => {
  const allTypes = Object.values(DisruptionEventType);
  const validCategories: DisruptionCategory[] = [
    'health', 'work', 'school', 'travel', 'environment', 'logistics', 'other',
  ];

  it('every event type has a category', () => {
    for (const type of allTypes) {
      expect(DISRUPTION_CATEGORIES[type], `Missing category for ${type}`).toBeDefined();
    }
  });

  it('all categories are valid', () => {
    for (const [type, cat] of Object.entries(DISRUPTION_CATEGORIES)) {
      expect(validCategories, `Invalid category "${cat}" for ${type}`).toContain(cat);
    }
  });

  it('health category contains expected types', () => {
    expect(DISRUPTION_CATEGORIES[DisruptionEventType.CHILD_SICK]).toBe('health');
    expect(DISRUPTION_CATEGORIES[DisruptionEventType.CAREGIVER_SICK]).toBe('health');
    expect(DISRUPTION_CATEGORIES[DisruptionEventType.HOSPITALIZATION]).toBe('health');
  });

  it('work category contains expected types', () => {
    expect(DISRUPTION_CATEGORIES[DisruptionEventType.WORK_SHIFT_CHANGE]).toBe('work');
    expect(DISRUPTION_CATEGORIES[DisruptionEventType.EMERGENCY_WORK_CALL]).toBe('work');
    expect(DISRUPTION_CATEGORIES[DisruptionEventType.PARENT_TRAVEL]).toBe('work');
  });

  it('travel category contains expected types', () => {
    expect(DISRUPTION_CATEGORIES[DisruptionEventType.HOLIDAY_TRAVEL]).toBe('travel');
    expect(DISRUPTION_CATEGORIES[DisruptionEventType.FLIGHT_DELAY]).toBe('travel');
  });
});
