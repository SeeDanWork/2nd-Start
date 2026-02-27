import { ScenarioDefinition } from '../types';
import { onboardingScenarios } from './onboarding';
import { routineScenarios } from './routine';
import { exceptionScenarios } from './exceptions';
import { emergencyScenarios } from './emergencies';
import { holidayScenarios } from './holidays';
import { activityScenarios } from './activities';
import { fairnessScenarios } from './fairness';
import { complianceScenarios } from './compliance';
import { billingScenarios } from './billing';
import { adminScenarios } from './admin';

const allScenarios: ScenarioDefinition[] = [
  ...onboardingScenarios,
  ...routineScenarios,
  ...exceptionScenarios,
  ...emergencyScenarios,
  ...holidayScenarios,
  ...activityScenarios,
  ...fairnessScenarios,
  ...complianceScenarios,
  ...billingScenarios,
  ...adminScenarios,
];

/** Map from scenario number → ScenarioDefinition */
export const scenarioRegistry: Map<number, ScenarioDefinition> = new Map(
  allScenarios.map((s) => [s.number, s]),
);

/** Map from scenario key → ScenarioDefinition */
export const scenarioByKey: Map<string, ScenarioDefinition> = new Map(
  allScenarios.map((s) => [s.key, s]),
);

/** All scenarios as a sorted array */
export const scenarioList: ScenarioDefinition[] = allScenarios.sort((a, b) => a.number - b.number);

export { allScenarios };
