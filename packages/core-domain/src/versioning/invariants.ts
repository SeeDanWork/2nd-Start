import { ScheduleVersion } from '../models/ScheduleVersion';
import { Proposal } from '../models/Proposal';
import { ScheduleStatus } from '../enums/ScheduleStatus';
import { ProposalStatus } from '../enums/ProposalStatus';
import { ScheduleImmutableError, ProposalResolutionError } from '../errors';

/**
 * Assert that a schedule version's contents can still be written to.
 * A schedule is immutable once it has been activated (activatedAt is set).
 */
export function assertScheduleWritable(schedule: ScheduleVersion): void {
  if (schedule.activatedAt !== null) {
    throw new ScheduleImmutableError(schedule.id);
  }
}

/**
 * Assert that a schedule version has been archived and cannot be reactivated.
 */
export function assertScheduleArchived(schedule: ScheduleVersion): void {
  if (schedule.status !== ScheduleStatus.ARCHIVED) {
    throw new Error(`Schedule ${schedule.id} is not archived (status: ${schedule.status})`);
  }
}

/**
 * Assert that a proposal is in PENDING status and can still be modified or resolved.
 */
export function assertProposalPending(proposal: Proposal): void {
  if (proposal.status !== ProposalStatus.PENDING) {
    throw new ProposalResolutionError(proposal.id, proposal.status);
  }
}

/**
 * Assert that a proposal has not been resolved (accepted/rejected/expired).
 * Resolved proposals and their schedule contents are immutable.
 */
export function assertProposalNotResolved(proposal: Proposal): void {
  if (proposal.resolvedAt !== null) {
    throw new ProposalResolutionError(proposal.id, proposal.status);
  }
}
