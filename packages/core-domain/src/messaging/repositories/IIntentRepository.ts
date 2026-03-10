import { IntentRecord } from '../types';

/**
 * Repository interface for intent persistence.
 */
export interface IIntentRepository {
  create(record: IntentRecord): Promise<IntentRecord>;
  findById(id: string): Promise<IntentRecord | null>;
  findByFamilyId(familyId: string): Promise<IntentRecord[]>;
  findByMessageId(messageId: string): Promise<IntentRecord[]>;
  findByParentId(parentId: string, options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<IntentRecord[]>;
}
