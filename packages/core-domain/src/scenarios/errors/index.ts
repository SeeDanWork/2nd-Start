export class ScenarioFixtureValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScenarioFixtureValidationError';
  }
}

export class ScenarioSeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScenarioSeedError';
  }
}

export class ScenarioExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScenarioExecutionError';
  }
}

export class ScenarioAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScenarioAssertionError';
  }
}

export class ScenarioDeterminismError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScenarioDeterminismError';
  }
}

export class ScenarioGoldenMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScenarioGoldenMismatchError';
  }
}
