import { baseLayout } from './base-layout';

export interface ProposalExpiredData {
  dates: string;
}

export function renderProposalExpired(data: ProposalExpiredData): { subject: string; html: string } {
  return {
    subject: 'Proposal has expired',
    html: baseLayout('Proposal Expired', `
      <h2>Proposal expired</h2>
      <p>A schedule proposal for <strong>${data.dates}</strong> has expired without a decision.</p>
      <p>No changes were made to the schedule. A new request can be submitted if needed.</p>
    `),
  };
}
