import { FamilyId, ParentId } from '../types';
import { IntentType } from '../enums';

export interface Intent {
  id: string;
  familyId: FamilyId;
  parentId: ParentId;
  type: IntentType;
  payload: Record<string, unknown>;
  confidence: number;
  createdAt: Date;
}

export function createIntent(
  id: string,
  familyId: FamilyId,
  parentId: ParentId,
  type: IntentType,
  payload: Record<string, unknown>,
  confidence: number,
): Intent {
  if (confidence < 0 || confidence > 1) {
    throw new Error('Confidence must be between 0 and 1');
  }
  return {
    id,
    familyId,
    parentId,
    type,
    payload,
    confidence,
    createdAt: new Date(),
  };
}
