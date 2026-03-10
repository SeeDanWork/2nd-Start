import { describe, it, expect, vi } from 'vitest';
import { MessageInterpretationPersistence } from '../core/MessageInterpretationPersistence';
import { IntentType } from '../types';
import { makeMessage, makeMockIntentRepo } from './helpers';

describe('MessageInterpretationPersistence', () => {
  it('persists successful interpretation', async () => {
    const repo = makeMockIntentRepo();
    const persistence = new MessageInterpretationPersistence(repo);

    await persistence.persistInterpretationResult({
      message: makeMessage({ messageId: 'msg-42' }),
      result: {
        status: 'SUCCESS',
        interpretedIntent: {
          familyId: 'family-1',
          parentId: 'parent-a',
          type: IntentType.SWAP_REQUEST,
          payload: { targetDate: '2026-03-15' },
          confidence: 0.88,
          resolvedEntities: { dates: ['2026-03-15'] },
          createdAt: '2026-03-09T10:00:00Z',
        },
      },
    });

    expect(repo.create).toHaveBeenCalledTimes(1);
    const record = repo.records[0];
    expect(record.messageId).toBe('msg-42');
    expect(record.status).toBe('SUCCESS');
    expect(record.type).toBe(IntentType.SWAP_REQUEST);
    expect(record.confidence).toBe(0.88);
    expect(record.rawText).toBeDefined();
  });

  it('persists ambiguous result for audit', async () => {
    const repo = makeMockIntentRepo();
    const persistence = new MessageInterpretationPersistence(repo);

    await persistence.persistInterpretationResult({
      message: makeMessage(),
      result: {
        status: 'AMBIGUOUS',
        failures: [{
          code: 'TIED_CANDIDATES',
          message: 'Two candidates tied',
        }],
      },
    });

    expect(repo.records.length).toBe(1);
    expect(repo.records[0].status).toBe('AMBIGUOUS');
  });

  it('persists invalid result for audit', async () => {
    const repo = makeMockIntentRepo();
    const persistence = new MessageInterpretationPersistence(repo);

    await persistence.persistInterpretationResult({
      message: makeMessage(),
      result: {
        status: 'INVALID',
        failures: [{ code: 'NO_CANDIDATES', message: 'No candidates' }],
      },
    });

    expect(repo.records.length).toBe(1);
    expect(repo.records[0].status).toBe('INVALID');
    expect(repo.records[0].resolutionMetadata).toBeDefined();
  });

  it('retrieval ordering is deterministic', async () => {
    const repo = makeMockIntentRepo();
    const persistence = new MessageInterpretationPersistence(repo);

    // Insert two records
    await persistence.persistInterpretationResult({
      message: makeMessage({ messageId: 'msg-2' }),
      result: {
        status: 'SUCCESS',
        interpretedIntent: {
          familyId: 'family-1',
          parentId: 'parent-a',
          type: IntentType.SWAP_REQUEST,
          payload: {},
          confidence: 0.8,
          resolvedEntities: {},
          createdAt: '2026-03-09T11:00:00Z',
        },
      },
    });

    await persistence.persistInterpretationResult({
      message: makeMessage({ messageId: 'msg-1' }),
      result: {
        status: 'SUCCESS',
        interpretedIntent: {
          familyId: 'family-1',
          parentId: 'parent-a',
          type: IntentType.DISRUPTION_REPORT,
          payload: { date: '2026-03-09', disruptionType: 'ILLNESS' },
          confidence: 0.9,
          resolvedEntities: {},
          createdAt: '2026-03-09T10:00:00Z',
        },
      },
    });

    const results = await repo.findByFamilyId('family-1');
    // Should be sorted by createdAt then id
    expect(results[0].createdAt <= results[1].createdAt).toBe(true);
  });
});
