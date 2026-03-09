import { ChildId, ParentId } from '../types';

export interface ProposalExchange {
  id: string;
  proposalScheduleId: string;
  childId: ChildId;
  date: string; // ISO date YYYY-MM-DD
  fromParentId: ParentId;
  toParentId: ParentId;
  time: string;
  location: string;
  createdAt: Date;
}
