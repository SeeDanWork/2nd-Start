import { ProposalNightOwnership } from './ProposalNightOwnership';
import { ProposalExchange } from './ProposalExchange';

export interface ProposalSnapshot {
  proposalId: string;
  proposalScheduleId: string;
  baseScheduleVersionId: string;
  nights: ProposalNightOwnership[];
  exchanges: ProposalExchange[];
}
