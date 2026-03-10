import { describe, it, expect } from 'vitest';
import { ExplanationSummaryBuilder } from '../builders/ExplanationSummaryBuilder';
import { ExplanationRecord } from '../types';
import { TARGET_ID, CREATED_AT } from './helpers';

function makeRecord(overrides: Partial<ExplanationRecord> = {}): ExplanationRecord {
  return {
    recordId: 'rec-1',
    targetType: 'SCHEDULE_VERSION',
    targetId: TARGET_ID,
    category: 'CHANGE',
    importance: 'PRIMARY',
    code: 'CHANGE_BASELINE_PRESERVATION',
    messageTemplate: 'Schedule adjusted on {date}.',
    data: {},
    sourceArtifacts: [],
    createdAt: CREATED_AT,
    ...overrides,
  };
}

describe('ExplanationSummaryBuilder', () => {
  const builder = new ExplanationSummaryBuilder();

  it('classifies primary / secondary / supporting correctly', () => {
    const records = [
      makeRecord({ recordId: 'r1', importance: 'PRIMARY', code: 'A' }),
      makeRecord({ recordId: 'r2', importance: 'SECONDARY', code: 'B' }),
      makeRecord({ recordId: 'r3', importance: 'SUPPORTING', code: 'C' }),
    ];

    const summary = builder.buildSummary({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      records,
      generatedAt: CREATED_AT,
    });

    expect(summary.primaryReasons).toHaveLength(1);
    expect(summary.secondaryReasons).toHaveLength(1);
    expect(summary.supportingReasons).toHaveLength(1);
    expect(summary.primaryReasons[0].recordId).toBe('r1');
  });

  it('deterministic ordering within summary buckets', () => {
    const records = [
      makeRecord({ recordId: 'r3', importance: 'PRIMARY', code: 'C', date: '2026-03-12' }),
      makeRecord({ recordId: 'r1', importance: 'PRIMARY', code: 'A', date: '2026-03-10' }),
      makeRecord({ recordId: 'r2', importance: 'PRIMARY', code: 'B', date: '2026-03-10' }),
    ];

    const summary = builder.buildSummary({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      records,
      generatedAt: CREATED_AT,
    });

    expect(summary.primaryReasons.map(r => r.recordId)).toEqual(['r1', 'r2', 'r3']);
  });

  it('avoids duplicate records', () => {
    const records = [
      makeRecord({ recordId: 'r1', importance: 'PRIMARY' }),
      makeRecord({ recordId: 'r1', importance: 'PRIMARY' }), // duplicate
      makeRecord({ recordId: 'r2', importance: 'SECONDARY' }),
    ];

    const summary = builder.buildSummary({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      records,
      generatedAt: CREATED_AT,
    });

    expect(summary.primaryReasons).toHaveLength(1);
    expect(summary.secondaryReasons).toHaveLength(1);
  });
});
