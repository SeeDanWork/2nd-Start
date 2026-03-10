export class CalendarNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarNormalizationError';
  }
}

export class CalendarScopeResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarScopeResolutionError';
  }
}

export class CalendarClassificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarClassificationError';
  }
}

export class CalendarIngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarIngestionError';
  }
}

export class CalendarTranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarTranslationError';
  }
}

export class CalendarDeduplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarDeduplicationError';
  }
}
