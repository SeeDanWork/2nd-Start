export class ScheduleImmutableError extends Error {
  constructor(scheduleVersionId: string) {
    super(`Schedule version ${scheduleVersionId} is immutable and cannot be modified`);
    this.name = 'ScheduleImmutableError';
  }
}

export class ScheduleNotFoundError extends Error {
  constructor(scheduleVersionId: string) {
    super(`Schedule version ${scheduleVersionId} not found`);
    this.name = 'ScheduleNotFoundError';
  }
}

export class ProposalNotFoundError extends Error {
  constructor(proposalId: string) {
    super(`Proposal ${proposalId} not found`);
    this.name = 'ProposalNotFoundError';
  }
}

export class ProposalStaleError extends Error {
  constructor(proposalId: string, baseVersionId: string) {
    super(`Proposal ${proposalId} is stale: base schedule version ${baseVersionId} is no longer active`);
    this.name = 'ProposalStaleError';
  }
}

export class ProposalResolutionError extends Error {
  constructor(proposalId: string, currentStatus: string) {
    super(`Proposal ${proposalId} cannot be resolved: current status is ${currentStatus}`);
    this.name = 'ProposalResolutionError';
  }
}

export class FamilyMismatchError extends Error {
  constructor(entityType: string, entityId: string, expectedFamilyId: string) {
    super(`${entityType} ${entityId} does not belong to family ${expectedFamilyId}`);
    this.name = 'FamilyMismatchError';
  }
}

export class InvalidScheduleActivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidScheduleActivationError';
  }
}

export class ProposalNoScheduleError extends Error {
  constructor(proposalId: string) {
    super(`Proposal ${proposalId} has no attached schedule contents`);
    this.name = 'ProposalNoScheduleError';
  }
}
