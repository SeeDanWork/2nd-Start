export class SolverInputValidationError extends Error {
  constructor(message: string) {
    super(`Solver input validation error: ${message}`);
    this.name = 'SolverInputValidationError';
  }
}

export class SolverModelBuildError extends Error {
  constructor(message: string) {
    super(`Solver model build error: ${message}`);
    this.name = 'SolverModelBuildError';
  }
}

export class SolverNoFeasibleSolutionError extends Error {
  constructor(message: string) {
    super(`No feasible solution: ${message}`);
    this.name = 'SolverNoFeasibleSolutionError';
  }
}

export class SolverCandidateExtractionError extends Error {
  constructor(message: string) {
    super(`Candidate extraction error: ${message}`);
    this.name = 'SolverCandidateExtractionError';
  }
}

export class SolverRankingError extends Error {
  constructor(message: string) {
    super(`Ranking error: ${message}`);
    this.name = 'SolverRankingError';
  }
}
