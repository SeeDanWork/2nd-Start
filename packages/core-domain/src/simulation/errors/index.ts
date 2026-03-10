export class SimulationFixtureValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulationFixtureValidationError';
  }
}

export class SimulationExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulationExecutionError';
  }
}

export class SimulationMetricError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulationMetricError';
  }
}

export class SimulationDeterminismError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulationDeterminismError';
  }
}

export class SimulationGoldenMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulationGoldenMismatchError';
  }
}
