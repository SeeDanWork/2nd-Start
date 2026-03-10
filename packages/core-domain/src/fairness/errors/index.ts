export class FairnessValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FairnessValidationError';
  }
}

export class FairnessLedgerNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FairnessLedgerNotFoundError';
  }
}

export class FairnessDuplicateEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FairnessDuplicateEventError';
  }
}

export class FairnessProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FairnessProjectionError';
  }
}

export class FairnessReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FairnessReconciliationError';
  }
}
