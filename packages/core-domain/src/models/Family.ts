import { FamilyId } from '../types';

export interface Family {
  id: FamilyId;
  name: string;
  createdAt: Date;
}

export function createFamily(id: FamilyId, name: string): Family {
  if (!name || name.trim().length === 0) {
    throw new Error('Family name must not be empty');
  }
  return {
    id,
    name: name.trim(),
    createdAt: new Date(),
  };
}
