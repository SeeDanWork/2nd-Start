import { Proposal } from '../models/Proposal';
import { ProposalStatus } from '../enums/ProposalStatus';

export interface IProposalRepository {
  findById(id: string): Promise<Proposal | null>;
  findPendingByBaseVersion(baseScheduleVersionId: string): Promise<Proposal[]>;
  create(proposal: Proposal): Promise<Proposal>;
  updateStatus(id: string, status: ProposalStatus, resolvedAt: Date | null, invalidatedReason: string | null): Promise<void>;
}
