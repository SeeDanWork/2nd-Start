export class IntentExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntentExtractionError';
  }
}

export class IntentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntentValidationError';
  }
}

export class IntentResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntentResolutionError';
  }
}

export class MessageInterpretationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessageInterpretationError';
  }
}

export class IntentRoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntentRoutingError';
  }
}

export class AmbiguousIntentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmbiguousIntentError';
  }
}

export class UnsupportedIntentTypeError extends Error {
  constructor(type: string) {
    super(`Unsupported intent type: ${type}`);
    this.name = 'UnsupportedIntentTypeError';
  }
}
