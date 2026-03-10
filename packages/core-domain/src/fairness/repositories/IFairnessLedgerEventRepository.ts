import { FairnessLedgerEventRecord } from '../types';

export interface IFairnessLedgerEventRepository {
  /**
   * Append event rows in batch.
   */
  appendBatch(
    events: Omit<FairnessLedgerEventRecord, 'id' | 'createdAt'>[],
  ): Promise<FairnessLedgerEventRecord[]>;

  /**
   * Check if an event with the given idempotency key already exists.
   */
  existsByIdempotencyKey(key: string): Promise<boolean>;

  /**
   * Fetch events by family/parent/date range.
   * Returns in deterministic order: effectiveDate, createdAt, id.
   */
  getEvents(input: {
    familyId: string;
    parentId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<FairnessLedgerEventRecord[]>;
}
