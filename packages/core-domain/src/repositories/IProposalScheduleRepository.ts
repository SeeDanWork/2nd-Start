import { ProposalSchedule } from '../models/ProposalSchedule';
import { ProposalNightOwnership } from '../models/ProposalNightOwnership';
import { ProposalExchange } from '../models/ProposalExchange';

export interface IProposalScheduleRepository {
  findByProposalId(proposalId: string): Promise<ProposalSchedule | null>;
  create(schedule: ProposalSchedule): Promise<ProposalSchedule>;
  findNightsByProposalScheduleId(proposalScheduleId: string): Promise<ProposalNightOwnership[]>;
  findExchangesByProposalScheduleId(proposalScheduleId: string): Promise<ProposalExchange[]>;
  createNights(nights: ProposalNightOwnership[]): Promise<void>;
  createExchanges(exchanges: ProposalExchange[]): Promise<void>;
}
