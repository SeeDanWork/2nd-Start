import { Scenario, ScenarioConfig, ScenarioStatus } from './types';
import { randomBytes } from 'crypto';

// Persist across HMR in dev mode using globalThis
const globalForStore = globalThis as unknown as {
  __scenarioStore?: Map<string, Scenario>;
};
const scenarios = globalForStore.__scenarioStore ??= new Map<string, Scenario>();

function genId(): string {
  return randomBytes(8).toString('hex');
}

export function createScenario(config: ScenarioConfig): Scenario {
  const scenario: Scenario = {
    id: genId(),
    config,
    status: 'draft',
    messagesA: [],
    messagesB: [],
    logs: [],
    schedule: [],
    currentDay: 0,
    bootstrapFacts: null,
    familyId: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  scenarios.set(scenario.id, scenario);
  return scenario;
}

export function getScenario(id: string): Scenario | null {
  return scenarios.get(id) || null;
}

export function listScenarios(): Scenario[] {
  return Array.from(scenarios.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function updateScenario(id: string, updates: Partial<Scenario>): Scenario | null {
  const scenario = scenarios.get(id);
  if (!scenario) return null;
  Object.assign(scenario, updates);
  return scenario;
}

export function deleteScenario(id: string): boolean {
  return scenarios.delete(id);
}

export function addLog(
  id: string,
  type: Scenario['logs'][number]['type'],
  phone: string,
  data: Record<string, unknown>,
): void {
  const scenario = scenarios.get(id);
  if (!scenario) return;
  scenario.logs.push({
    id: genId(),
    timestamp: new Date().toISOString(),
    type,
    phone,
    data,
  });
}
