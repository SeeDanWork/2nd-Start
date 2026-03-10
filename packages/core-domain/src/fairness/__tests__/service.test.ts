import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FairnessStateService } from '../core/FairnessStateService';
import { IFairnessLedgerRepository } from '../repositories/IFairnessLedgerRepository';
import { IFairnessLedgerEventRepository } from '../repositories/IFairnessLedgerEventRepository';
import { FairnessLedgerRow, FairnessLedgerEventRecord } from '../types';
import { makeDeltaBatch, makeLedgerRow, FAMILY_ID, PARENT_A, PARENT_B } from './helpers';

function createMockRepos() {
  const rows: FairnessLedgerRow[] = [];
  const events: FairnessLedgerEventRecord[] = [];
  const idempotencyKeys = new Set<string>();

  const ledgerRepo: IFairnessLedgerRepository = {
    getByFamily: vi.fn(async (familyId: string) => rows.filter(r => r.familyId === familyId)),
    upsert: vi.fn(async (input) => {
      let existing = rows.find(r => r.familyId === input.familyId && r.parentId === input.parentId);
      if (existing) {
        existing.nightDeviation += input.nightDeviationDelta;
        existing.weekendDeviation += input.weekendDeviationDelta;
        existing.holidayDeviation += input.holidayDeviationDelta;
        existing.lastReason = input.lastReason;
        existing.lastSourceType = input.lastSourceType;
        existing.lastSourceId = input.lastSourceId;
        return existing;
      }
      const newRow: FairnessLedgerRow = {
        id: `row-${input.parentId}`,
        familyId: input.familyId,
        parentId: input.parentId,
        nightDeviation: input.nightDeviationDelta,
        weekendDeviation: input.weekendDeviationDelta,
        holidayDeviation: input.holidayDeviationDelta,
        lastReason: input.lastReason,
        lastSourceType: input.lastSourceType,
        lastSourceId: input.lastSourceId,
        updatedAt: new Date().toISOString(),
      };
      rows.push(newRow);
      return newRow;
    }),
  };

  const eventRepo: IFairnessLedgerEventRepository = {
    appendBatch: vi.fn(async (batch) => {
      const created: FairnessLedgerEventRecord[] = batch.map((e: any, i: number) => {
        const record: FairnessLedgerEventRecord = {
          id: `evt-${events.length + i}`,
          ...e,
          createdAt: new Date().toISOString(),
        };
        if (e.idempotencyKey) idempotencyKeys.add(e.idempotencyKey);
        events.push(record);
        return record;
      });
      return created;
    }),
    existsByIdempotencyKey: vi.fn(async (key: string) => idempotencyKeys.has(key)),
    getEvents: vi.fn(async (input) => {
      return events
        .filter(e => e.familyId === input.familyId)
        .filter(e => !input.parentId || e.parentId === input.parentId)
        .filter(e => !input.startDate || e.effectiveDate >= input.startDate)
        .filter(e => !input.endDate || e.effectiveDate <= input.endDate)
        .sort((a, b) => {
          const dc = a.effectiveDate.localeCompare(b.effectiveDate);
          if (dc !== 0) return dc;
          return a.id.localeCompare(b.id);
        });
    }),
  };

  return { ledgerRepo, eventRepo, rows, events, idempotencyKeys };
}

describe('FairnessStateService', () => {
  let service: FairnessStateService;
  let mocks: ReturnType<typeof createMockRepos>;

  beforeEach(() => {
    mocks = createMockRepos();
    service = new FairnessStateService({
      ledgerRepo: mocks.ledgerRepo,
      eventRepo: mocks.eventRepo,
    });
  });

  it('returns empty ledger for new family', async () => {
    const state = await service.getCurrentLedgerState(FAMILY_ID, [PARENT_A, PARENT_B]);

    expect(state.familyId).toBe(FAMILY_ID);
    expect(state.byParentId[PARENT_A].nightDeviation).toBe(0);
    expect(state.byParentId[PARENT_B].nightDeviation).toBe(0);
  });

  it('appends event batch and updates aggregate rows', async () => {
    const batch = makeDeltaBatch();

    const updated = await service.appendDeltaBatch(batch);

    expect(mocks.events).toHaveLength(2); // one per parent
    expect(mocks.rows).toHaveLength(2);
    expect(updated.byParentId[PARENT_A].nightDeviation).toBe(-1);
    expect(updated.byParentId[PARENT_B].nightDeviation).toBe(1);
  });

  it('rejects duplicate event append via idempotency guard', async () => {
    const batch = makeDeltaBatch();
    await service.appendDeltaBatch(batch);

    await expect(service.appendDeltaBatch(batch)).rejects.toThrow('Duplicate event');
  });

  it('retrieves event history in deterministic order', async () => {
    const batch = makeDeltaBatch();
    await service.appendDeltaBatch(batch);

    const events = await service.getLedgerEvents({ familyId: FAMILY_ID });

    expect(events).toHaveLength(2);
    expect(events[0].effectiveDate).toBe('2026-03-04');
  });

  it('returns current state for empty delta batch', async () => {
    // Pre-populate a row
    mocks.rows.push(makeLedgerRow(PARENT_A, { nightDeviation: 5 }));

    const state = await service.appendDeltaBatch(makeDeltaBatch({ deltas: [] }));

    expect(state.byParentId[PARENT_A].nightDeviation).toBe(5);
  });

  it('projects candidate without persistence', async () => {
    const result = await service.projectCandidate({
      familyId: FAMILY_ID,
      currentLedger: {
        familyId: FAMILY_ID,
        byParentId: {
          [PARENT_A]: { nightDeviation: -2, weekendDeviation: 0, holidayDeviation: 0 },
          [PARENT_B]: { nightDeviation: 2, weekendDeviation: 0, holidayDeviation: 0 },
        },
      },
      scheduleWindowStart: '2026-03-02',
      scheduleWindowEnd: '2026-03-15',
    });

    expect(result.familyId).toBe(FAMILY_ID);
    expect(result.projectedState.byParentId[PARENT_A].nightDeviation).toBe(-2);
    // No events should have been created
    expect(mocks.events).toHaveLength(0);
  });
});
