import { ChildId, ParentId } from '../types';

export interface ProposalNightOwnership {
  id: string;
  proposalScheduleId: string;
  date: string; // ISO date YYYY-MM-DD
  childId: ChildId;
  parentId: ParentId;
  createdAt: Date;
}
