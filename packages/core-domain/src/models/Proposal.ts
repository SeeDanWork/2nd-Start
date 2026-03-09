import { ScheduleId } from '../types';
import { ProposalStatus } from '../enums';

export interface Proposal {
  id: string;
  baseScheduleVersionId: ScheduleId;
  createdBy: string;
  type: string;
  status: ProposalStatus;
  createdAt: Date;
  expiresAt: Date | null;
  resolvedAt: Date | null;
  invalidatedReason: string | null;
}

export function createProposal(
  id: string,
  baseScheduleVersionId: ScheduleId,
  createdBy: string,
  type: string,
  expiresAt?: Date | null,
): Proposal {
  return {
    id,
    baseScheduleVersionId,
    createdBy,
    type,
    status: ProposalStatus.PENDING,
    createdAt: new Date(),
    expiresAt: expiresAt ?? null,
    resolvedAt: null,
    invalidatedReason: null,
  };
}
