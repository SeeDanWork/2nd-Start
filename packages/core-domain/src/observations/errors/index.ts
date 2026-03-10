export class ObservationEvidenceError extends Error {
  constructor(message: string) {
    super(`Observation evidence error: ${message}`);
    this.name = 'ObservationEvidenceError';
  }
}

export class PatternDetectionError extends Error {
  constructor(message: string) {
    super(`Pattern detection error: ${message}`);
    this.name = 'PatternDetectionError';
  }
}

export class PolicySuggestionError extends Error {
  constructor(message: string) {
    super(`Policy suggestion error: ${message}`);
    this.name = 'PolicySuggestionError';
  }
}

export class PolicySuggestionResolutionError extends Error {
  constructor(message: string) {
    super(`Policy suggestion resolution error: ${message}`);
    this.name = 'PolicySuggestionResolutionError';
  }
}

export class PolicySuggestionReviewError extends Error {
  constructor(message: string) {
    super(`Policy suggestion review error: ${message}`);
    this.name = 'PolicySuggestionReviewError';
  }
}

export class UnsupportedSuggestionConversionError extends Error {
  constructor(suggestionType: string) {
    super(`Unsupported suggestion conversion: ${suggestionType} cannot be mapped to a policy rule`);
    this.name = 'UnsupportedSuggestionConversionError';
  }
}
