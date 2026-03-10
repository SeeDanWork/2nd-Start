import { BehaviorObservationWindow, ObservationEvidenceRecord } from '../types';

/**
 * Base interface for all evidence extractors.
 * Each extractor pulls evidence of a specific behavior type
 * from the domain state within the given window.
 */
export interface ObservationEvidenceExtractor {
  evidenceType: string;
  extractEvidence(input: {
    window: BehaviorObservationWindow;
  }): ObservationEvidenceRecord[];
}
