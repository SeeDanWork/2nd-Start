import { FamilyId, ParentId } from '../types';

export interface FairnessLedger {
  id: string;
  familyId: FamilyId;
  parentId: ParentId;
  nightDeviation: number;
  weekendDeviation: number;
  holidayDeviation: number;
  updatedAt: Date;
}

export function createFairnessLedger(
  id: string,
  familyId: FamilyId,
  parentId: ParentId,
): FairnessLedger {
  return {
    id,
    familyId,
    parentId,
    nightDeviation: 0,
    weekendDeviation: 0,
    holidayDeviation: 0,
    updatedAt: new Date(),
  };
}
