import { ScenarioFixture } from '../types';
import { ScenarioFixtureValidationError } from '../errors';
import { ScenarioFixtureValidator } from './ScenarioFixtureValidator';

/**
 * Loads scenario fixtures from TypeScript modules or JSON.
 */
export class ScenarioFixtureLoader {
  private readonly validator = new ScenarioFixtureValidator();

  /**
   * Load a fixture from a module path (TypeScript or JSON).
   * The module must default-export or named-export a ScenarioFixture.
   */
  async loadFixture(input: { path: string }): Promise<ScenarioFixture> {
    let mod: any;
    try {
      mod = await import(input.path);
    } catch (err) {
      throw new ScenarioFixtureValidationError(
        `Failed to load fixture from ${input.path}: ${(err as Error).message}`,
      );
    }

    const fixture: ScenarioFixture = mod.default ?? mod.fixture ?? mod;
    if (!fixture || !fixture.scenarioId) {
      throw new ScenarioFixtureValidationError(
        `Fixture at ${input.path} does not export a valid ScenarioFixture`,
      );
    }

    this.validator.validateFixture(fixture);
    return fixture;
  }

  /**
   * Load a fixture from an in-memory object (useful for built-in fixtures).
   */
  loadFromObject(fixture: ScenarioFixture): ScenarioFixture {
    this.validator.validateFixture(fixture);
    return fixture;
  }
}
