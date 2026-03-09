import { ChildId, FamilyId } from '../types';

export interface Child {
  id: ChildId;
  familyId: FamilyId;
  name: string;
  birthDate: string; // ISO date YYYY-MM-DD
  createdAt: Date;
}

export function createChild(
  id: ChildId,
  familyId: FamilyId,
  name: string,
  birthDate: string,
): Child {
  if (!name || name.trim().length === 0) {
    throw new Error('Child name must not be empty');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new Error('Birth date must be YYYY-MM-DD format');
  }
  return {
    id,
    familyId,
    name: name.trim(),
    birthDate,
    createdAt: new Date(),
  };
}
