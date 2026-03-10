export class RepairInputValidationError extends Error {
  constructor(message: string) {
    super(`Repair input validation error: ${message}`);
    this.name = 'RepairInputValidationError';
  }
}

export class OverlayValidationError extends Error {
  constructor(message: string) {
    super(`Overlay validation error: ${message}`);
    this.name = 'OverlayValidationError';
  }
}

export class OverlayConflictError extends Error {
  constructor(message: string) {
    super(`Overlay conflict: ${message}`);
    this.name = 'OverlayConflictError';
  }
}

export class RepairWindowError extends Error {
  constructor(message: string) {
    super(`Repair window error: ${message}`);
    this.name = 'RepairWindowError';
  }
}

export class RepairModelBuildError extends Error {
  constructor(message: string) {
    super(`Repair model build error: ${message}`);
    this.name = 'RepairModelBuildError';
  }
}

export class RepairNoFeasibleSolutionError extends Error {
  constructor(message: string) {
    super(`No feasible repair solution: ${message}`);
    this.name = 'RepairNoFeasibleSolutionError';
  }
}

export class RepairCandidateExtractionError extends Error {
  constructor(message: string) {
    super(`Repair candidate extraction error: ${message}`);
    this.name = 'RepairCandidateExtractionError';
  }
}

export class RepairRankingError extends Error {
  constructor(message: string) {
    super(`Repair ranking error: ${message}`);
    this.name = 'RepairRankingError';
  }
}
