import {
  BehaviorObservationWindow,
  ObservationEvidenceRecord,
  PolicySuggestionCandidate,
  PolicySuggestionType,
} from '../types';

export interface PatternDetector {
  suggestionType: PolicySuggestionType;
  detect(input: {
    familyId: string;
    window: BehaviorObservationWindow;
    evidence: ObservationEvidenceRecord[];
  }): PolicySuggestionCandidate[];
}
