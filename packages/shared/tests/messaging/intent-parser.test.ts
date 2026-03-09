import { describe, it, expect } from 'vitest';
import { parseIntent } from '../../src/messaging/intent-parser';

describe('parseIntent', () => {
  it('parses schedule query', () => {
    const r = parseIntent('Who has the kids Monday?');
    expect(r.intent).toBe('confirm_schedule');
    expect(r.confidence).toBeGreaterThanOrEqual(0.7);
    expect(r.entities.day).toBe('monday');
  });

  it('parses swap request', () => {
    const r = parseIntent('Can we swap Friday?');
    expect(r.intent).toBe('request_swap');
    expect(r.confidence).toBeGreaterThanOrEqual(0.7);
    expect(r.entities.day).toBe('friday');
  });

  it('parses illness report', () => {
    const r = parseIntent('Kai is sick today');
    expect(r.intent).toBe('report_illness');
    expect(r.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('parses disruption report', () => {
    const r = parseIntent('School is closed tomorrow');
    expect(r.intent).toBe('report_disruption');
    expect(r.confidence).toBeGreaterThanOrEqual(0.7);
    expect(r.entities.relative_date).toBe('tomorrow');
  });

  it('parses approval - yes', () => {
    const r = parseIntent('Yes');
    expect(r.intent).toBe('approve');
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('parses decline - no', () => {
    const r = parseIntent('No');
    expect(r.intent).toBe('decline');
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('parses help', () => {
    const r = parseIntent('Help');
    expect(r.intent).toBe('help');
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('parses view schedule', () => {
    const r = parseIntent('Send me the schedule link');
    expect(r.intent).toBe('view_schedule');
    expect(r.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('returns unknown for gibberish', () => {
    const r = parseIntent('asdfghjkl');
    expect(r.intent).toBe('unknown');
    expect(r.confidence).toBeLessThanOrEqual(0.5);
  });

  it('parses swap with Saturday', () => {
    const r = parseIntent('Can she take them Saturday?');
    expect(r.intent).toBe('request_swap');
    expect(r.entities.day).toBe('saturday');
  });

  it('extracts child name from illness', () => {
    const r = parseIntent('Kai is sick today');
    expect(r.entities.child_name).toBe('Kai');
  });

  it('parses sounds good as approve', () => {
    const r = parseIntent('Sounds good');
    expect(r.intent).toBe('approve');
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });
});
