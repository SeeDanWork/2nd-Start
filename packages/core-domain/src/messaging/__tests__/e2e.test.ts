import { describe, it, expect, vi } from 'vitest';
import { MessageInterpretationService } from '../core/MessageInterpretationService';
import { MockIntentExtractionProvider, createStandardMockProvider } from '../extraction/MockIntentExtractionProvider';
import { IntentRouter } from '../routing/IntentRouter';
import { IntentType } from '../types';
import { makeMessage, makeFamilyContext } from './helpers';

function buildE2EService(provider?: MockIntentExtractionProvider) {
  const p = provider ?? createStandardMockProvider();
  return new MessageInterpretationService({
    extractionProvider: p,
    familyContextLoader: {
      loadContext: vi.fn(async () => makeFamilyContext()),
    },
  });
}

describe('End-to-end with mock provider', () => {
  it('availability change message produces validated structured intent', async () => {
    const service = buildE2EService();

    const result = await service.interpretMessage({
      message: makeMessage({ text: "I'll be unavailable next week" }),
      referenceTimeIso: '2026-03-09T10:00:00Z',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.interpretedIntent!.type).toBe(IntentType.AVAILABILITY_CHANGE);
    expect(result.interpretedIntent!.payload).toHaveProperty('dateRange');
    expect(result.interpretedIntent!.payload).toHaveProperty('availability', 'UNAVAILABLE');

    // Route it
    const router = new IntentRouter();
    const routeResult = router.route(result.interpretedIntent!);
    expect(routeResult.routeType).toBe('AVAILABILITY_CHANGE');
    expect(routeResult.accepted).toBe(true);
  });

  it('disruption report message produces validated structured intent', async () => {
    const service = buildE2EService();

    const result = await service.interpretMessage({
      message: makeMessage({ text: 'Charlie is sick today, can Bob take him?' }),
      referenceTimeIso: '2026-03-09T10:00:00Z',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.interpretedIntent!.type).toBe(IntentType.DISRUPTION_REPORT);
    expect(result.interpretedIntent!.payload).toHaveProperty('disruptionType', 'ILLNESS');

    // Check entity resolution found Charlie and Bob
    const entities = result.interpretedIntent!.resolvedEntities;
    expect(entities.childIds).toContain('child-1'); // Charlie
    expect(entities.parentIds).toContain('parent-b'); // Bob
  });

  it('policy confirmation resolves known suggestion id', async () => {
    const service = buildE2EService();

    const result = await service.interpretMessage({
      message: makeMessage({ text: 'Yes, accept policy please' }),
      referenceTimeIso: '2026-03-09T10:00:00Z',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.interpretedIntent!.type).toBe(IntentType.POLICY_CONFIRMATION);
    expect(result.interpretedIntent!.payload).toHaveProperty('policyId', 'policy-1');
    expect(result.interpretedIntent!.payload).toHaveProperty('decision', 'ACCEPT');
  });

  it('swap request includes resolved date from text', async () => {
    const provider = createStandardMockProvider();
    const service = buildE2EService(provider);

    const result = await service.interpretMessage({
      message: makeMessage({ text: 'Can we swap next Thursday?' }),
      referenceTimeIso: '2026-03-09T10:00:00Z',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.interpretedIntent!.type).toBe(IntentType.SWAP_REQUEST);
    // Resolved dates should include the Thursday
    expect(result.interpretedIntent!.resolvedEntities.dates).toBeDefined();
  });

  it('proposal request message produces structured intent', async () => {
    const service = buildE2EService();

    const result = await service.interpretMessage({
      message: makeMessage({ text: 'I need a new proposal for next week' }),
      referenceTimeIso: '2026-03-09T10:00:00Z',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.interpretedIntent!.type).toBe(IntentType.PROPOSAL_REQUEST);

    const router = new IntentRouter();
    const routeResult = router.route(result.interpretedIntent!);
    expect(routeResult.routeType).toBe('PROPOSAL_REQUEST');
  });
});
