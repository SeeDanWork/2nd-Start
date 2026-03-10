import {
  FairnessLedgerState,
  FairnessDeltaBatch,
  FairnessLedgerEventRecord,
  FairnessProjectionInput,
  FairnessProjectionResult,
} from '../types';
import { FairnessValidationError, FairnessDuplicateEventError } from '../errors';
import { applyDeltaBatch } from '../ledger/FairnessLedgerAccumulator';
import { buildLedgerState, createEmptyLedgerState } from '../materialization/FairnessSnapshotBuilder';
import { project } from '../projection/FairnessProjectionEngine';
import { buildIdempotencyKey } from './IdempotencyKeyBuilder';
import { IFairnessLedgerRepository } from '../repositories/IFairnessLedgerRepository';
import { IFairnessLedgerEventRepository } from '../repositories/IFairnessLedgerEventRepository';

export interface FairnessStateServiceDeps {
  ledgerRepo: IFairnessLedgerRepository;
  eventRepo: IFairnessLedgerEventRepository;
}

/**
 * Main service for fairness ledger operations.
 * Loads, updates, and projects fairness state.
 */
export class FairnessStateService {
  constructor(private readonly deps: FairnessStateServiceDeps) {}

  /**
   * Load current ledger state for a family.
   */
  async getCurrentLedgerState(
    familyId: string,
    parentIds: string[],
  ): Promise<FairnessLedgerState> {
    const rows = await this.deps.ledgerRepo.getByFamily(familyId);
    if (rows.length === 0) {
      return createEmptyLedgerState(familyId, parentIds);
    }
    return buildLedgerState(rows, parentIds);
  }

  /**
   * Append a delta batch atomically: insert events + update aggregate rows.
   * Returns the updated ledger state.
   */
  async appendDeltaBatch(batch: FairnessDeltaBatch): Promise<FairnessLedgerState> {
    if (!batch.familyId) {
      throw new FairnessValidationError('familyId is required');
    }
    if (batch.deltas.length === 0) {
      // Nothing to do, return current state
      const rows = await this.deps.ledgerRepo.getByFamily(batch.familyId);
      const parentIds = rows.map(r => r.parentId);
      return buildLedgerState(rows, parentIds);
    }

    // Build idempotency keys and check for duplicates
    const events: Array<{
      parentId: string;
      nightDelta: number;
      weekendDelta: number;
      holidayDelta: number;
      idempotencyKey: string;
    }> = [];

    for (const delta of batch.deltas) {
      const key = buildIdempotencyKey(batch, delta.parentId);
      const exists = await this.deps.eventRepo.existsByIdempotencyKey(key);
      if (exists) {
        throw new FairnessDuplicateEventError(
          `Duplicate event for parent ${delta.parentId} with key ${key}`,
        );
      }
      events.push({
        parentId: delta.parentId,
        nightDelta: delta.nightDelta,
        weekendDelta: delta.weekendDelta,
        holidayDelta: delta.holidayDelta,
        idempotencyKey: key,
      });
    }

    // Insert events
    const eventRecords: Omit<FairnessLedgerEventRecord, 'id' | 'createdAt'>[] = events.map(e => ({
      familyId: batch.familyId,
      parentId: e.parentId,
      eventType: batch.eventType,
      sourceType: batch.sourceType,
      sourceId: batch.sourceId,
      nightDelta: e.nightDelta,
      weekendDelta: e.weekendDelta,
      holidayDelta: e.holidayDelta,
      reason: batch.reason,
      effectiveDate: batch.effectiveDate,
      idempotencyKey: e.idempotencyKey,
      metadata: batch.metadata,
    }));

    await this.deps.eventRepo.appendBatch(eventRecords);

    // Update aggregate ledger rows
    for (const delta of batch.deltas) {
      await this.deps.ledgerRepo.upsert({
        familyId: batch.familyId,
        parentId: delta.parentId,
        nightDeviationDelta: delta.nightDelta,
        weekendDeviationDelta: delta.weekendDelta,
        holidayDeviationDelta: delta.holidayDelta,
        lastReason: batch.reason,
        lastSourceType: batch.sourceType,
        lastSourceId: batch.sourceId,
      });
    }

    // Return updated state
    const rows = await this.deps.ledgerRepo.getByFamily(batch.familyId);
    const parentIds = rows.map(r => r.parentId);
    return buildLedgerState(rows, parentIds);
  }

  /**
   * Project candidate effects without persistence.
   */
  async projectCandidate(
    input: FairnessProjectionInput,
  ): Promise<FairnessProjectionResult> {
    return project(input);
  }

  /**
   * Retrieve auditable event history.
   */
  async getLedgerEvents(input: {
    familyId: string;
    parentId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<FairnessLedgerEventRecord[]> {
    return this.deps.eventRepo.getEvents(input);
  }
}
