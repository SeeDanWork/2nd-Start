import { IntentExtractionProvider } from './IntentExtractionProvider';
import {
  IncomingMessage,
  ExtractionFamilyContext,
  IntentExtractionResponse,
  ExtractedIntentCandidate,
  IntentType,
} from '../types';

/**
 * Deterministic mock extraction provider for tests.
 * Returns pre-configured responses based on message text patterns.
 */
export class MockIntentExtractionProvider implements IntentExtractionProvider {
  private fixtures: Map<string, ExtractedIntentCandidate[]> = new Map();
  private defaultResponse: ExtractedIntentCandidate[] = [];

  /**
   * Register a fixture: when message text contains `pattern`, return these candidates.
   */
  addFixture(pattern: string, candidates: ExtractedIntentCandidate[]): void {
    this.fixtures.set(pattern, candidates);
  }

  /**
   * Set the default response when no fixture matches.
   */
  setDefaultResponse(candidates: ExtractedIntentCandidate[]): void {
    this.defaultResponse = candidates;
  }

  async extract(input: {
    message: IncomingMessage;
    familyContext: ExtractionFamilyContext;
  }): Promise<IntentExtractionResponse> {
    const text = input.message.text.toLowerCase();

    // Check fixtures in insertion order
    for (const [pattern, candidates] of this.fixtures) {
      if (text.includes(pattern.toLowerCase())) {
        return {
          candidates,
          rawModelOutput: JSON.stringify(candidates),
          providerMetadata: { provider: 'mock', matchedPattern: pattern },
        };
      }
    }

    return {
      candidates: this.defaultResponse,
      rawModelOutput: JSON.stringify(this.defaultResponse),
      providerMetadata: { provider: 'mock', matchedPattern: null },
    };
  }
}

/**
 * Pre-built fixtures for common test scenarios.
 */
export function createStandardMockProvider(): MockIntentExtractionProvider {
  const provider = new MockIntentExtractionProvider();

  provider.addFixture('unavailable', [{
    type: IntentType.AVAILABILITY_CHANGE,
    payload: {
      dateRange: { startDate: '2026-03-10', endDate: '2026-03-12' },
      availability: 'UNAVAILABLE',
      reason: 'business trip',
    },
    confidence: 0.92,
  }]);

  provider.addFixture('swap', [{
    type: IntentType.SWAP_REQUEST,
    payload: {
      targetDate: '2026-03-15',
      reason: 'schedule conflict',
    },
    confidence: 0.88,
  }]);

  provider.addFixture('sick', [{
    type: IntentType.DISRUPTION_REPORT,
    payload: {
      date: '2026-03-09',
      disruptionType: 'ILLNESS',
      reason: 'child is sick',
    },
    confidence: 0.95,
  }]);

  provider.addFixture('proposal', [{
    type: IntentType.PROPOSAL_REQUEST,
    payload: {
      targetDateRange: { startDate: '2026-03-10', endDate: '2026-03-20' },
      reason: 'need schedule adjustment',
    },
    confidence: 0.85,
  }]);

  provider.addFixture('accept policy', [{
    type: IntentType.POLICY_CONFIRMATION,
    payload: {
      policyId: 'policy-1',
      decision: 'ACCEPT',
    },
    confidence: 0.97,
  }]);

  return provider;
}
