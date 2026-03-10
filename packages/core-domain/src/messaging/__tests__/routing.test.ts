import { describe, it, expect } from 'vitest';
import { IntentRouter } from '../routing/IntentRouter';
import { UnsupportedIntentTypeError } from '../errors';
import { IntentType } from '../types';
import { makeInterpretedIntent } from './helpers';

describe('IntentRouter', () => {
  const router = new IntentRouter();

  it('routes AVAILABILITY_CHANGE to correct route', () => {
    const intent = makeInterpretedIntent({ type: IntentType.AVAILABILITY_CHANGE });
    const result = router.route(intent);
    expect(result.routeType).toBe('AVAILABILITY_CHANGE');
    expect(result.accepted).toBe(true);
  });

  it('routes SWAP_REQUEST to correct route', () => {
    const intent = makeInterpretedIntent({ type: IntentType.SWAP_REQUEST });
    const result = router.route(intent);
    expect(result.routeType).toBe('SWAP_REQUEST');
    expect(result.accepted).toBe(true);
  });

  it('routes DISRUPTION_REPORT to correct route', () => {
    const intent = makeInterpretedIntent({ type: IntentType.DISRUPTION_REPORT });
    const result = router.route(intent);
    expect(result.routeType).toBe('DISRUPTION_REPORT');
    expect(result.accepted).toBe(true);
  });

  it('routes PROPOSAL_REQUEST to correct route', () => {
    const intent = makeInterpretedIntent({ type: IntentType.PROPOSAL_REQUEST });
    const result = router.route(intent);
    expect(result.routeType).toBe('PROPOSAL_REQUEST');
    expect(result.accepted).toBe(true);
  });

  it('routes POLICY_CONFIRMATION to correct route', () => {
    const intent = makeInterpretedIntent({ type: IntentType.POLICY_CONFIRMATION });
    const result = router.route(intent);
    expect(result.routeType).toBe('POLICY_CONFIRMATION');
    expect(result.accepted).toBe(true);
  });

  it('throws UnsupportedIntentTypeError for unknown type', () => {
    const intent = makeInterpretedIntent({ type: 'UNKNOWN_TYPE' as any });
    expect(() => router.route(intent)).toThrow(UnsupportedIntentTypeError);
  });

  it('route result includes intent data', () => {
    const intent = makeInterpretedIntent({
      type: IntentType.SWAP_REQUEST,
      payload: { targetDate: '2026-03-15' },
    });
    const result = router.route(intent);
    expect(result.data).toBeDefined();
    expect(result.data!.intentType).toBe(IntentType.SWAP_REQUEST);
  });
});
