export class ExplanationBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExplanationBuildError';
  }
}

export class ExplanationQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExplanationQueryError';
  }
}

export class ExplanationPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExplanationPersistenceError';
  }
}

export class ExplanationArtifactNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExplanationArtifactNormalizationError';
  }
}

export class UnsupportedExplanationTargetError extends Error {
  constructor(targetType: string) {
    super(`Unsupported explanation target type: ${targetType}`);
    this.name = 'UnsupportedExplanationTargetError';
  }
}
