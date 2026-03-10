import { describe, it, expect } from 'vitest';
import { ExplanationQueryService } from '../query/ExplanationQueryService';
import { ExplanationQueryError } from '../errors';
import { ExplanationRecord } from '../types';
import { TARGET_ID, CREATED_AT, makeMockRecordRepo } from './helpers';

describe('ExplanationQueryService', () => {
  it('fetches persisted bundle correctly', async () => {
    const repo = makeMockRecordRepo();
    const record: ExplanationRecord = {
      recordId: 'rec-1',
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
      category: 'CHANGE',
      importance: 'PRIMARY',
      code: 'CHANGE_BASELINE_PRESERVATION',
      messageTemplate: 'Schedule adjusted on {date}.',
      data: {},
      date: '2026-03-10',
      sourceArtifacts: [{ sourceType: 'DIFF', artifactType: 'CHANGED_NIGHT' }],
      createdAt: CREATED_AT,
    };
    await repo.insert([record]);

    const service = new ExplanationQueryService({ recordRepository: repo });
    const result = await service.getBundle({
      targetType: 'SCHEDULE_VERSION',
      targetId: TARGET_ID,
    });

    expect(result.bundle.targetType).toBe('SCHEDULE_VERSION');
    expect(result.bundle.targetId).toBe(TARGET_ID);
    expect(result.bundle.changeExplanations).toHaveLength(1);
    expect(result.bundle.summary.primaryReasons).toHaveLength(1);
  });

  it('deterministic query ordering', async () => {
    const repo = makeMockRecordRepo();
    const records: ExplanationRecord[] = [
      {
        recordId: 'rec-z',
        targetType: 'PROPOSAL',
        targetId: TARGET_ID,
        category: 'CHANGE',
        importance: 'SECONDARY',
        code: 'Z_CODE',
        messageTemplate: 'Z template.',
        data: {},
        sourceArtifacts: [],
        createdAt: CREATED_AT,
      },
      {
        recordId: 'rec-a',
        targetType: 'PROPOSAL',
        targetId: TARGET_ID,
        category: 'FAIRNESS',
        importance: 'PRIMARY',
        code: 'A_CODE',
        messageTemplate: 'A template.',
        data: {},
        sourceArtifacts: [],
        createdAt: CREATED_AT,
      },
    ];
    await repo.insert(records);

    const service = new ExplanationQueryService({ recordRepository: repo });
    const r1 = await service.getBundle({ targetType: 'PROPOSAL', targetId: TARGET_ID });
    const r2 = await service.getBundle({ targetType: 'PROPOSAL', targetId: TARGET_ID });

    expect(r1.bundle.summary.primaryReasons.map(r => r.recordId))
      .toEqual(r2.bundle.summary.primaryReasons.map(r => r.recordId));
  });

  it('explicit error when bundle unavailable and regeneration unsupported', async () => {
    const repo = makeMockRecordRepo();
    const service = new ExplanationQueryService({ recordRepository: repo });

    await expect(
      service.getBundle({ targetType: 'SCHEDULE_VERSION', targetId: 'nonexistent' }),
    ).rejects.toThrow(ExplanationQueryError);
  });
});
