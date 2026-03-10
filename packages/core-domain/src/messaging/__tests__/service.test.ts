import { describe, it, expect, vi } from 'vitest';
import { MessageInterpretationService } from '../core/MessageInterpretationService';
import { MessageInterpretationPersistence } from '../core/MessageInterpretationPersistence';
import { MockIntentExtractionProvider } from '../extraction/MockIntentExtractionProvider';
import { IntentType } from '../types';
import { makeMessage, makeFamilyContext, makeMockIntentRepo } from './helpers';

function buildService(overrides?: {
  provider?: MockIntentExtractionProvider;
  withPersistence?: boolean;
}) {
  const provider = overrides?.provider ?? new MockIntentExtractionProvider();
  const context = makeFamilyContext();
  const repo = makeMockIntentRepo();
  const persistence = overrides?.withPersistence
    ? new MessageInterpretationPersistence(repo)
    : undefined;

  const service = new MessageInterpretationService({
    extractionProvider: provider,
    familyContextLoader: {
      loadContext: vi.fn(async () => context),
    },
    persistence,
  });

  return { service, provider, repo };
}

describe('MessageInterpretationService', () => {
  it('successful extraction -> validation -> resolution -> SUCCESS', async () => {
    const { service, provider } = buildService();
    provider.addFixture('unavailable march 10', [{
      type: IntentType.AVAILABILITY_CHANGE,
      payload: {
        dateRange: { startDate: '2026-03-10', endDate: '2026-03-12' },
        availability: 'UNAVAILABLE',
        reason: 'business trip',
      },
      confidence: 0.92,
    }]);

    const result = await service.interpretMessage({
      message: makeMessage({ text: "I'll be unavailable march 10 through the 12th" }),
      referenceTimeIso: '2026-03-09T10:00:00Z',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.interpretedIntent).toBeDefined();
    expect(result.interpretedIntent!.type).toBe(IntentType.AVAILABILITY_CHANGE);
    expect(result.interpretedIntent!.confidence).toBe(0.92);
  });

  it('top invalid candidate falls back to next valid candidate', async () => {
    const { service, provider } = buildService();
    provider.addFixture('schedule', [
      // Invalid candidate (bad payload)
      {
        type: IntentType.AVAILABILITY_CHANGE,
        payload: { availability: 'UNAVAILABLE' }, // missing dateRange
        confidence: 0.95,
      },
      // Valid fallback
      {
        type: IntentType.PROPOSAL_REQUEST,
        payload: {
          targetDate: '2026-03-15',
          reason: 'need change',
        },
        confidence: 0.80,
      },
    ]);

    const result = await service.interpretMessage({
      message: makeMessage({ text: 'Can we adjust the schedule?' }),
      referenceTimeIso: '2026-03-09T10:00:00Z',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.interpretedIntent!.type).toBe(IntentType.PROPOSAL_REQUEST);
  });

  it('no valid candidate returns INVALID', async () => {
    const { service, provider } = buildService();
    provider.addFixture('gibberish', [
      {
        type: 'NOT_A_REAL_TYPE' as any,
        payload: {},
        confidence: 0.9,
      },
    ]);

    const result = await service.interpretMessage({
      message: makeMessage({ text: 'gibberish nonsense' }),
      referenceTimeIso: '2026-03-09T10:00:00Z',
    });

    expect(result.status).toBe('INVALID');
    expect(result.failures).toBeDefined();
    expect(result.failures!.length).toBeGreaterThan(0);
  });

  it('no candidates at all returns INVALID', async () => {
    const { service } = buildService();
    // Default mock returns empty candidates

    const result = await service.interpretMessage({
      message: makeMessage({ text: 'hello' }),
      referenceTimeIso: '2026-03-09T10:00:00Z',
    });

    expect(result.status).toBe('INVALID');
    expect(result.failures!.some(f => f.code === 'NO_CANDIDATES')).toBe(true);
  });

  it('competing top candidates return AMBIGUOUS', async () => {
    const { service, provider } = buildService();
    provider.addFixture('change', [
      {
        type: IntentType.AVAILABILITY_CHANGE,
        payload: {
          dateRange: { startDate: '2026-03-10', endDate: '2026-03-12' },
          availability: 'UNAVAILABLE',
        },
        confidence: 0.85,
      },
      {
        type: IntentType.SWAP_REQUEST,
        payload: { targetDate: '2026-03-10' },
        confidence: 0.85,
      },
    ]);

    const result = await service.interpretMessage({
      message: makeMessage({ text: 'I want to change March 10' }),
      referenceTimeIso: '2026-03-09T10:00:00Z',
    });

    expect(result.status).toBe('AMBIGUOUS');
    expect(result.clarificationHints).toBeDefined();
  });

  it('successful result persists intent audit data', async () => {
    const { service, provider, repo } = buildService({ withPersistence: true });
    provider.addFixture('swap thursday', [{
      type: IntentType.SWAP_REQUEST,
      payload: { targetDate: '2026-03-12', reason: 'conflict' },
      confidence: 0.88,
    }]);

    await service.interpretMessage({
      message: makeMessage({ text: 'Can we swap thursday?' }),
      referenceTimeIso: '2026-03-09T10:00:00Z',
    });

    expect(repo.create).toHaveBeenCalled();
    expect(repo.records.length).toBe(1);
    expect(repo.records[0].status).toBe('SUCCESS');
    expect(repo.records[0].rawText).toBe('Can we swap thursday?');
    expect(repo.records[0].type).toBe(IntentType.SWAP_REQUEST);
  });

  it('extraction error returns INVALID and persists', async () => {
    const failingProvider = {
      extract: vi.fn(async () => { throw new Error('LLM down'); }),
    };

    const repo = makeMockIntentRepo();
    const service = new MessageInterpretationService({
      extractionProvider: failingProvider,
      familyContextLoader: { loadContext: vi.fn(async () => makeFamilyContext()) },
      persistence: new MessageInterpretationPersistence(repo),
    });

    const result = await service.interpretMessage({
      message: makeMessage(),
      referenceTimeIso: '2026-03-09T10:00:00Z',
    });

    expect(result.status).toBe('INVALID');
    expect(result.failures!.some(f => f.code === 'EXTRACTION_FAILED')).toBe(true);
    expect(repo.records.length).toBe(1);
  });
});
