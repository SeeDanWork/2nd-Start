import { FairnessLedgerRow } from '../types';

export interface FairnessLedgerUpsertInput {
  familyId: string;
  parentId: string;
  nightDeviationDelta: number;
  weekendDeviationDelta: number;
  holidayDeviationDelta: number;
  lastReason?: string;
  lastSourceType?: string;
  lastSourceId?: string;
}

export interface IFairnessLedgerRepository {
  /**
   * Get all ledger rows for a family.
   */
  getByFamily(familyId: string): Promise<FairnessLedgerRow[]>;

  /**
   * Upsert a ledger row: create if missing, add deltas if existing.
   * Must be atomic per row.
   */
  upsert(input: FairnessLedgerUpsertInput): Promise<FairnessLedgerRow>;
}
