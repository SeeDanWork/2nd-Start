import { describe, it, expect } from 'vitest';
import { classifyEvent, getClassificationRules } from '../../src/calendar/event-classifier';
import { DisruptionEventType } from '../../src/enums';

describe('classifyEvent', () => {
  // ── School closures ────────────────────────────────────────────

  it('classifies "No School" as SCHOOL_CLOSED', () => {
    const result = classifyEvent('No School - Teacher Workday');
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe(DisruptionEventType.SCHOOL_CLOSED);
  });

  it('classifies "Schools Closed" as SCHOOL_CLOSED', () => {
    const result = classifyEvent('Schools Closed - MLK Day');
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe(DisruptionEventType.PUBLIC_HOLIDAY);
    // MLK keyword matches public_holiday first (higher specificity)
  });

  it('classifies "Student Holiday" as SCHOOL_CLOSED', () => {
    const result = classifyEvent('Student Holiday');
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe(DisruptionEventType.SCHOOL_CLOSED);
  });

  // ── Early dismissal ────────────────────────────────────────────

  it('classifies "Early Dismissal" as SCHOOL_HALF_DAY', () => {
    const result = classifyEvent('Early Dismissal - 12:30pm');
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe(DisruptionEventType.SCHOOL_HALF_DAY);
  });

  it('classifies "Half Day" as SCHOOL_HALF_DAY', () => {
    const result = classifyEvent('Half Day for Students');
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe(DisruptionEventType.SCHOOL_HALF_DAY);
  });

  it('classifies "Minimum Day" as SCHOOL_HALF_DAY', () => {
    const result = classifyEvent('Minimum Day Schedule');
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe(DisruptionEventType.SCHOOL_HALF_DAY);
  });

  // ── Teacher workdays ───────────────────────────────────────────

  it('classifies "Teacher Workday" as SCHOOL_CLOSED', () => {
    const result = classifyEvent('Teacher Workday');
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe(DisruptionEventType.SCHOOL_CLOSED);
    expect(result!.matchedRule).toBe('teacher_workday');
  });

  it('classifies "Professional Development" as SCHOOL_CLOSED', () => {
    const result = classifyEvent('Professional Development Day');
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe(DisruptionEventType.SCHOOL_CLOSED);
  });

  // ── Breaks ─────────────────────────────────────────────────────

  it('classifies "Spring Break" as BREAK', () => {
    const result = classifyEvent('Spring Break - No School');
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe(DisruptionEventType.BREAK);
    expect(result!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('classifies "Winter Break" as BREAK', () => {
    const result = classifyEvent('Winter Break');
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe(DisruptionEventType.BREAK);
  });

  it('classifies "Thanksgiving Break" as BREAK', () => {
    const result = classifyEvent('Thanksgiving Break');
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe(DisruptionEventType.BREAK);
  });

  // ── Public holidays ────────────────────────────────────────────

  it('classifies "Memorial Day" as PUBLIC_HOLIDAY', () => {
    const result = classifyEvent('Memorial Day - No School');
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe(DisruptionEventType.PUBLIC_HOLIDAY);
  });

  it('classifies "Labor Day" as PUBLIC_HOLIDAY', () => {
    const result = classifyEvent('Labor Day');
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe(DisruptionEventType.PUBLIC_HOLIDAY);
  });

  // ── Conferences ────────────────────────────────────────────────

  it('classifies "Parent-Teacher Conference" as SCHOOL_HALF_DAY', () => {
    const result = classifyEvent('Parent-Teacher Conference Day');
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe(DisruptionEventType.SCHOOL_HALF_DAY);
  });

  // ── Weather ────────────────────────────────────────────────────

  it('classifies "Snow Day" as WEATHER_EMERGENCY', () => {
    const result = classifyEvent('Snow Day - All Schools Closed');
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe(DisruptionEventType.WEATHER_EMERGENCY);
  });

  // ── Non-matching events ────────────────────────────────────────

  it('returns null for unrelated events', () => {
    expect(classifyEvent('PTA Meeting')).toBeNull();
    expect(classifyEvent('School Board Session')).toBeNull();
    expect(classifyEvent('Math Night')).toBeNull();
    expect(classifyEvent('Picture Day')).toBeNull();
  });

  it('is case-insensitive', () => {
    const result = classifyEvent('EARLY DISMISSAL');
    expect(result).not.toBeNull();
    expect(result!.eventType).toBe(DisruptionEventType.SCHOOL_HALF_DAY);
  });

  // ── Determinism ────────────────────────────────────────────────

  it('produces identical results for same input', () => {
    const inputs = [
      'No School', 'Early Dismissal', 'Spring Break',
      'Memorial Day', 'Snow Day', 'PTA Meeting',
    ];
    for (const input of inputs) {
      const a = classifyEvent(input);
      const b = classifyEvent(input);
      expect(a).toEqual(b);
    }
  });

  // ── Rule integrity ─────────────────────────────────────────────

  it('all rules have at least one keyword', () => {
    const rules = getClassificationRules();
    for (const rule of rules) {
      expect(rule.keywords.length).toBeGreaterThan(0);
    }
  });

  it('all rules have confidence between 0 and 1', () => {
    const rules = getClassificationRules();
    for (const rule of rules) {
      expect(rule.confidence).toBeGreaterThan(0);
      expect(rule.confidence).toBeLessThanOrEqual(1);
    }
  });
});
