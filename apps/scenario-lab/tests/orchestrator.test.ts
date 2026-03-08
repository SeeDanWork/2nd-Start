import { describe, it, expect, beforeEach } from 'vitest';
import { orchestrate } from '../lib/conversation/orchestrator';
import { createScenario } from '../lib/store';
import { ScenarioConfig } from '../lib/types';

const CONFIG: ScenarioConfig = {
  name: 'Test Scenario',
  description: 'Test',
  children: [{ age: 7, name: 'Emma' }],
  parentA: { label: 'Mom', phone: '+1111' },
  parentB: { label: 'Dad', phone: '+2222' },
  template: 'alternating_weeks',
  targetSplit: 50,
  lockedNights: [],
  distanceMiles: 10,
  tags: [],
  personaA: 'cooperative_organizer',
  personaB: 'cooperative_organizer',
  scenarioIds: ['child_sick_exchange'],
  simulationWeeks: 4,
};

let scenarioId: string;

beforeEach(() => {
  const s = createScenario(CONFIG);
  scenarioId = s.id;
});

describe('orchestrate — routing', () => {
  it('returns 404 for unknown scenario', async () => {
    const res = await orchestrate({ scenarioId: 'nonexistent', phone: '+1111', action: 'connect' });
    expect(res.status).toBe(404);
    expect(res.data.error).toContain('not found');
  });

  it('returns 400 for invalid action', async () => {
    const res = await orchestrate({ scenarioId, phone: '+1111', action: 'invalid' as any });
    expect(res.status).toBe(400);
    expect(res.data.error).toContain('Invalid action');
  });
});

describe('orchestrate — connect', () => {
  it('returns welcome message', async () => {
    const res = await orchestrate({ scenarioId, phone: '+1111', action: 'connect' });
    expect(res.status).toBe(200);
    expect(res.data.response).toContain('Welcome');
  });
});

describe('orchestrate — send', () => {
  it('processes user message and returns response', async () => {
    const res = await orchestrate({
      scenarioId,
      phone: '+1111',
      action: 'send',
      body: 'I have 1 child, Emma, age 7',
    });
    expect(res.status).toBe(200);
    expect(res.data.response).toBeTruthy();
    expect(res.data.messagesA.length).toBeGreaterThan(0);
  });
});

describe('orchestrate — auto_respond', () => {
  it('generates persona-driven response', async () => {
    // First, seed with a system message
    await orchestrate({ scenarioId, phone: '+1111', action: 'connect' });

    const res = await orchestrate({ scenarioId, phone: '+1111', action: 'auto_respond' });
    expect(res.status).toBe(200);
    expect(res.data.autoMessage).toBeTruthy();
    expect(res.data.response).toBeTruthy();
  });

  it('returns 400 when no persona assigned', async () => {
    const s = createScenario({ ...CONFIG, personaA: undefined, personaB: undefined });
    const res = await orchestrate({ scenarioId: s.id, phone: '+1111', action: 'auto_respond' });
    expect(res.status).toBe(400);
    expect(res.data.error).toContain('persona');
  });
});

describe('orchestrate — simulate_pair', () => {
  it('returns responses for both parents', async () => {
    const res = await orchestrate({ scenarioId, phone: '+1111', action: 'simulate_pair' });
    expect(res.status).toBe(200);
    expect(res.data.responseA).toBeTruthy();
    expect(res.data.responseB).toBeTruthy();
    expect(res.data.decisionA).toBeTruthy();
    expect(res.data.decisionB).toBeTruthy();
    expect(res.data.resolutionPaths).toBeDefined();
  });

  it('returns 400 when personas missing', async () => {
    const s = createScenario({ ...CONFIG, personaA: undefined, personaB: undefined });
    const res = await orchestrate({ scenarioId: s.id, phone: '+1111', action: 'simulate_pair' });
    expect(res.status).toBe(400);
  });
});

describe('orchestrate — run_setup', () => {
  it('completes onboarding and generates schedule', async () => {
    const res = await orchestrate({ scenarioId, phone: '+1111', action: 'run_setup' });
    expect(res.status).toBe(200);
    expect(res.data.setupSteps.length).toBeGreaterThan(0);
    expect(res.data.schedule.length).toBeGreaterThan(0);
    expect(res.data.messagesA.length).toBeGreaterThan(0);
    expect(res.data.messagesB.length).toBeGreaterThan(0);
  });
});

describe('orchestrate — step_day', () => {
  it('advances simulation by 1 day', async () => {
    // Run setup first
    await orchestrate({ scenarioId, phone: '+1111', action: 'run_setup' });

    const res = await orchestrate({ scenarioId, phone: '+1111', action: 'step_day', body: 1 });
    expect(res.status).toBe(200);
    expect(res.data.days).toHaveLength(1);
    expect(res.data.totalDaysRun).toBe(1);
  });

  it('advances by multiple days', async () => {
    await orchestrate({ scenarioId, phone: '+1111', action: 'run_setup' });

    const res = await orchestrate({ scenarioId, phone: '+1111', action: 'step_day', body: 7 });
    expect(res.status).toBe(200);
    expect(res.data.days).toHaveLength(7);
    expect(res.data.totalDaysRun).toBe(7);
  });

  it('generates schedule if not already created', async () => {
    const res = await orchestrate({ scenarioId, phone: '+1111', action: 'step_day', body: 1 });
    expect(res.status).toBe(200);
    expect(res.data.schedule.length).toBeGreaterThan(0);
  });
});

describe('orchestrate — inject_disruption', () => {
  it('injects disruption with full mediation flow', async () => {
    await orchestrate({ scenarioId, phone: '+1111', action: 'run_setup' });

    const res = await orchestrate({
      scenarioId,
      phone: '+1111',
      action: 'inject_disruption',
      body: 'child_sick_exchange',
    });
    expect(res.status).toBe(200);
    expect(res.data.activeDisruption).toBeTruthy();
    expect(res.data.activeDisruption.eventType).toBe('child_sick');
    expect(res.data.messagesA.length).toBeGreaterThan(0);
    expect(res.data.messagesB.length).toBeGreaterThan(0);
  });

  it('returns error for unknown scenario catalog entry', async () => {
    await orchestrate({ scenarioId, phone: '+1111', action: 'run_setup' });
    const res = await orchestrate({
      scenarioId,
      phone: '+1111',
      action: 'inject_disruption',
      body: 'nonexistent_scenario',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('returns 409 for duplicate disruption (multi-day stays active)', async () => {
    await orchestrate({ scenarioId, phone: '+1111', action: 'run_setup' });

    // Use work_emergency (difficulty 1 = today_only = resolves immediately)
    // Instead use a difficulty 3+ scenario so it stays as FOLLOWUP_PENDING
    // late_pickup is difficulty 2, work_emergency is difficulty 1
    // vacation_request is difficulty 3
    const res1 = await orchestrate({ scenarioId, phone: '+1111', action: 'inject_disruption', body: 'vacation_request' });
    expect(res1.status).toBe(200);
    // vacation_request difficulty=3 → 2_3_days → FOLLOWUP_PENDING (not RESOLVED)
    expect(res1.data.activeDisruption.state).toBe('FOLLOWUP_PENDING');

    // Duplicate of same type on same day
    const res2 = await orchestrate({ scenarioId, phone: '+1111', action: 'inject_disruption', body: 'vacation_request' });
    expect(res2.status).toBe(409);
    expect(res2.data.error).toContain('already active');
  });
});
