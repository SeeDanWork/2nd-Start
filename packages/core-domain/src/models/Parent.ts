import { ParentId, FamilyId } from '../types';
import { ParentRole } from '../enums';

export interface Parent {
  id: ParentId;
  familyId: FamilyId;
  name: string;
  role: ParentRole;
  email: string;
  createdAt: Date;
}

export function createParent(
  id: ParentId,
  familyId: FamilyId,
  name: string,
  role: ParentRole,
  email: string,
): Parent {
  if (!name || name.trim().length === 0) {
    throw new Error('Parent name must not be empty');
  }
  if (!email || !email.includes('@')) {
    throw new Error('Valid email is required');
  }
  return {
    id,
    familyId,
    name: name.trim(),
    role,
    email: email.toLowerCase().trim(),
    createdAt: new Date(),
  };
}
