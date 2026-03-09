import { describe, it, expect } from 'vitest';
import { createScenario, getScenario, listScenarios, updateScenario, deleteScenario, addLog } from '../lib/store';
import { ScenarioConfig } from '../lib/types';

const CONFIG: ScenarioConfig = {
  name: 'Test',
  description: 'Test scenario',
  children: [{ age: 7, name: 'Emma' }],
  parentA: { label: 'Mom', phone: '+1111' },
  parentB: { label: 'Dad', phone: '+2222' },
  template: 'alternating_weeks',
  targetSplit: 50,
  lockedNights: [],
  distanceMiles: 10,
  tags: [],
};

describe('createScenario', () => {
  it('creates scenario with valid defaults', () => {
    const s = createScenario(CONFIG);
    expect(s.id).toHaveLength(16);
    expect(s.config).toBe(CONFIG);
    expect(s.status).toBe('draft');
    expect(s.messagesA).toEqual([]);
    expect(s.messagesB).toEqual([]);
    expect(s.schedule).toEqual([]);
    expect(s.currentDay).toBe(0);
    expect(s.activeDisruptions).toEqual([]);
    expect(s.createdAt).toBeTruthy();
  });

  it('generates unique IDs', () => {
    const a = createScenario(CONFIG);
    const b = createScenario(CONFIG);
    expect(a.id).not.toBe(b.id);
  });
});

describe('getScenario', () => {
  it('retrieves existing scenario', () => {
    const s = createScenario(CONFIG);
    const found = getScenario(s.id);
    expect(found).toBe(s);
  });

  it('returns null for unknown ID', () => {
    expect(getScenario('nonexistent')).toBeNull();
  });
});

describe('listScenarios', () => {
  it('returns all scenarios including newly created ones', () => {
    const a = createScenario({ ...CONFIG, name: 'A' });
    const b = createScenario({ ...CONFIG, name: 'B' });
    const list = listScenarios();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.some(s => s.id === a.id)).toBe(true);
    expect(list.some(s => s.id === b.id)).toBe(true);
  });
});

describe('updateScenario', () => {
  it('updates scenario fields', () => {
    const s = createScenario(CONFIG);
    const updated = updateScenario(s.id, { status: 'simulating' });
    expect(updated!.status).toBe('simulating');
    expect(getScenario(s.id)!.status).toBe('simulating');
  });

  it('returns null for unknown ID', () => {
    expect(updateScenario('nonexistent', {})).toBeNull();
  });
});

describe('deleteScenario', () => {
  it('removes scenario', () => {
    const s = createScenario(CONFIG);
    expect(deleteScenario(s.id)).toBe(true);
    expect(getScenario(s.id)).toBeNull();
  });

  it('returns false for unknown ID', () => {
    expect(deleteScenario('nonexistent')).toBe(false);
  });
});

describe('addLog', () => {
  it('appends log entry', () => {
    const s = createScenario(CONFIG);
    addLog(s.id, 'info', '+1111', { foo: 'bar' });
    expect(s.logs).toHaveLength(1);
    expect(s.logs[0].type).toBe('info');
    expect(s.logs[0].phone).toBe('+1111');
    expect(s.logs[0].data).toEqual({ foo: 'bar' });
    expect(s.logs[0].timestamp).toBeTruthy();
  });

  it('does nothing for unknown scenario', () => {
    // Should not throw
    addLog('nonexistent', 'info', '+1111', {});
  });
});
