import { describe, it, expect } from 'vitest';
import { buildSolverInput } from '../core/SolverInputBuilder';
import { computeStabilityScore } from '../objectives/StabilityObjective';
import { computeFamilyStructureScore } from '../objectives/FamilyStructureObjective';
import { computeFairnessScore } from '../objectives/FairnessObjective';
import { computeParentPreferenceScore } from '../objectives/ParentPreferenceObjective';
import { computeChildPreferenceScore } from '../objectives/ChildPreferenceObjective';
import { computeLogisticsScore } from '../objectives/LogisticsObjective';
import { computeConvenienceScore } from '../objectives/ConvenienceObjective';
import { makeSolverInput, makeSingleChildInput, makeWindow, PARENT_A, PARENT_B, CHILD_1, CHILD_2 } from './helpers';
import { CandidateNight, CandidateExchange } from '../types';
import { ScheduleId } from '../../types';

describe('StabilityObjective', () => {
  it('returns 1.0 when no baseline exists', () => {
    const input = makeSolverInput();
    const normalized = buildSolverInput(input);
    const nights: CandidateNight[] = [
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
    ];
    const result = computeStabilityScore(nights, [], normalized);
    expect(result.score).toBe(1.0);
    expect(result.changedNights).toBe(0);
  });

  it('improves when fewer baseline changes occur', () => {
    const baseline = {
      scheduleVersionId: 'v1',
      familyId: 'family-1',
      startDate: '2026-03-02',
      endDate: '2026-03-04',
      nights: [
        { id: 'n1', scheduleId: 'v1' as ScheduleId, date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A, createdAt: new Date() },
        { id: 'n2', scheduleId: 'v1' as ScheduleId, date: '2026-03-03', childId: CHILD_1, parentId: PARENT_A, createdAt: new Date() },
        { id: 'n3', scheduleId: 'v1' as ScheduleId, date: '2026-03-04', childId: CHILD_1, parentId: PARENT_A, createdAt: new Date() },
      ],
      exchanges: [],
    };

    // Zero changes
    const inputNoChange = makeSingleChildInput({
      window: makeWindow('2026-03-02', '2026-03-04'),
      baselineSchedule: baseline,
    });
    const normNoChange = buildSolverInput(inputNoChange);
    const noChangeNights: CandidateNight[] = [
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-03', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-04', childId: CHILD_1, parentId: PARENT_A },
    ];
    const noChangeResult = computeStabilityScore(noChangeNights, [], normNoChange);

    // One change
    const oneChangeNights: CandidateNight[] = [
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-03', childId: CHILD_1, parentId: PARENT_B }, // changed
      { date: '2026-03-04', childId: CHILD_1, parentId: PARENT_A },
    ];
    const oneChangeResult = computeStabilityScore(oneChangeNights, [], normNoChange);

    expect(noChangeResult.score).toBeGreaterThan(oneChangeResult.score);
    expect(noChangeResult.changedNights).toBe(0);
    expect(oneChangeResult.changedNights).toBe(1);
  });
});

describe('FamilyStructureObjective', () => {
  it('returns 1.0 for single-child family', () => {
    const input = makeSingleChildInput();
    const normalized = buildSolverInput(input);
    const nights: CandidateNight[] = [
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
    ];
    const result = computeFamilyStructureScore(nights, normalized);
    expect(result.score).toBe(1.0);
    expect(result.splitNights).toBe(0);
  });

  it('penalizes sibling splits', () => {
    const input = makeSolverInput({ window: makeWindow('2026-03-02', '2026-03-03') });
    const normalized = buildSolverInput(input);

    // All together
    const togetherNights: CandidateNight[] = [
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-02', childId: CHILD_2, parentId: PARENT_A },
      { date: '2026-03-03', childId: CHILD_1, parentId: PARENT_B },
      { date: '2026-03-03', childId: CHILD_2, parentId: PARENT_B },
    ];
    const togetherResult = computeFamilyStructureScore(togetherNights, normalized);

    // Split on one day
    const splitNights: CandidateNight[] = [
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-02', childId: CHILD_2, parentId: PARENT_B },
      { date: '2026-03-03', childId: CHILD_1, parentId: PARENT_B },
      { date: '2026-03-03', childId: CHILD_2, parentId: PARENT_B },
    ];
    const splitResult = computeFamilyStructureScore(splitNights, normalized);

    expect(togetherResult.score).toBeGreaterThan(splitResult.score);
    expect(togetherResult.splitNights).toBe(0);
    expect(splitResult.splitNights).toBe(1);
  });
});

describe('FairnessObjective', () => {
  it('penalizes uneven night distribution', () => {
    const input = makeSolverInput({ window: makeWindow('2026-03-02', '2026-03-05') });
    const normalized = buildSolverInput(input);

    // Even: 4 nights per parent
    const evenNights: CandidateNight[] = [
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-02', childId: CHILD_2, parentId: PARENT_A },
      { date: '2026-03-03', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-03', childId: CHILD_2, parentId: PARENT_A },
      { date: '2026-03-04', childId: CHILD_1, parentId: PARENT_B },
      { date: '2026-03-04', childId: CHILD_2, parentId: PARENT_B },
      { date: '2026-03-05', childId: CHILD_1, parentId: PARENT_B },
      { date: '2026-03-05', childId: CHILD_2, parentId: PARENT_B },
    ];
    const evenResult = computeFairnessScore(evenNights, normalized);

    // Uneven: 6 vs 2
    const unevenNights: CandidateNight[] = [
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-02', childId: CHILD_2, parentId: PARENT_A },
      { date: '2026-03-03', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-03', childId: CHILD_2, parentId: PARENT_A },
      { date: '2026-03-04', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-04', childId: CHILD_2, parentId: PARENT_A },
      { date: '2026-03-05', childId: CHILD_1, parentId: PARENT_B },
      { date: '2026-03-05', childId: CHILD_2, parentId: PARENT_B },
    ];
    const unevenResult = computeFairnessScore(unevenNights, normalized);

    expect(evenResult.total).toBeGreaterThan(unevenResult.total);
    expect(evenResult.nights).toBeGreaterThan(unevenResult.nights);
  });

  it('returns neutral when data absent (single parent)', () => {
    const input = makeSolverInput({
      parents: [{ id: PARENT_A, familyId: 'family-1' as any, name: 'Mom', role: 'PRIMARY' as any, email: 'a@t.com', createdAt: new Date() }],
      window: makeWindow('2026-03-02', '2026-03-03'),
    });
    const normalized = buildSolverInput(input);
    const nights: CandidateNight[] = [
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-02', childId: CHILD_2, parentId: PARENT_A },
      { date: '2026-03-03', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-03', childId: CHILD_2, parentId: PARENT_A },
    ];
    const result = computeFairnessScore(nights, normalized);
    expect(result.total).toBe(1.0);
  });
});

describe('Placeholder objectives', () => {
  it('parent preference returns neutral', () => {
    const input = makeSolverInput();
    const normalized = buildSolverInput(input);
    expect(computeParentPreferenceScore([], normalized)).toBe(1.0);
  });

  it('child preference returns neutral', () => {
    const input = makeSolverInput();
    const normalized = buildSolverInput(input);
    expect(computeChildPreferenceScore([], normalized)).toBe(1.0);
  });

  it('logistics returns neutral', () => {
    const input = makeSolverInput();
    const normalized = buildSolverInput(input);
    expect(computeLogisticsScore([], normalized)).toBe(1.0);
  });

  it('convenience returns neutral', () => {
    const input = makeSolverInput();
    const normalized = buildSolverInput(input);
    expect(computeConvenienceScore([], [], normalized)).toBe(1.0);
  });
});
