import { ObservationEvidenceRecord, BehaviorObservationWindow } from '../types';

export interface IObservationEvidenceRepository {
  save(record: ObservationEvidenceRecord): Promise<void>;
  saveBatch(records: ObservationEvidenceRecord[]): Promise<void>;
  findByFamilyId(familyId: string): Promise<ObservationEvidenceRecord[]>;
  findByWindow(window: BehaviorObservationWindow): Promise<ObservationEvidenceRecord[]>;
  findById(evidenceId: string): Promise<ObservationEvidenceRecord | null>;
  findByIds(evidenceIds: string[]): Promise<ObservationEvidenceRecord[]>;
}
