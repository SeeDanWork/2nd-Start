export class ProposalGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalGenerationError';
  }
}

export class ProposalReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalReviewError';
  }
}

export class ProposalAcceptanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalAcceptanceError';
  }
}

export class ProposalRejectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalRejectionError';
  }
}

export class ProposalInvalidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalInvalidationError';
  }
}

export class ProposalOriginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalOriginError';
  }
}

export class ProposalArtifactError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalArtifactError';
  }
}
