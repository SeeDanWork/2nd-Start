import { ProposalGenerationInput, ProposalOrigin } from '../types';
import { ProposalGenerationError } from '../errors';
import { materializeCandidate } from './ProposalCandidateMaterializer';
import { ProposalService, CreateProposalInput, AttachProposalScheduleInput } from '../../services/ProposalService';
import { ScheduleId, SolverScoreBreakdown, FairnessProjection } from '../../types';

/**
 * Higher-level generation service that creates proposals from solver/repair results.
 * One proposal per candidate, each with its own proposal schedule branch.
 */
export class ProposalGenerationService {
  constructor(private readonly proposalService: ProposalService) {}

  /**
   * Generate proposals from generic candidate input.
   * Returns proposal IDs in candidate order.
   */
  async generateProposals(input: ProposalGenerationInput): Promise<string[]> {
    if (!input.familyId) {
      throw new ProposalGenerationError('familyId is required');
    }
    if (!input.baseScheduleVersionId) {
      throw new ProposalGenerationError('baseScheduleVersionId is required');
    }
    if (input.candidates.length === 0) {
      throw new ProposalGenerationError('At least one candidate is required');
    }

    const proposalIds: string[] = [];

    for (let i = 0; i < input.candidates.length; i++) {
      const candidate = input.candidates[i];
      const proposalId = `${input.baseScheduleVersionId}-${input.origin}-${i}`;
      const proposalScheduleId = `${proposalId}-schedule`;

      // Create proposal
      const createInput: CreateProposalInput = {
        id: proposalId,
        baseScheduleVersionId: input.baseScheduleVersionId as ScheduleId,
        createdBy: input.createdBy,
        type: input.type,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      };

      await this.proposalService.createProposal(createInput);

      // Materialize candidate
      const materialized = materializeCandidate({
        candidate,
        proposalScheduleId,
      });

      // Attach schedule
      const attachInput: AttachProposalScheduleInput = {
        id: proposalScheduleId,
        proposalId,
        scoreBreakdown: materialized.scoreBreakdown as unknown as SolverScoreBreakdown,
        fairnessProjection: materialized.fairnessProjection as unknown as FairnessProjection,
        stabilityDelta: materialized.stabilityDelta,
        nights: materialized.nights,
        exchanges: materialized.exchanges,
      };

      await this.proposalService.attachProposalSchedule(attachInput);
      proposalIds.push(proposalId);
    }

    return proposalIds;
  }

  /**
   * Convenience: generate from baseline solver result.
   */
  async generateFromBaselineSolverResult(input: ProposalGenerationInput): Promise<string[]> {
    return this.generateProposals({
      ...input,
      origin: 'BASELINE_SOLVER',
    });
  }

  /**
   * Convenience: generate from repair solver result.
   */
  async generateFromRepairResult(input: ProposalGenerationInput): Promise<string[]> {
    return this.generateProposals({
      ...input,
      origin: 'REPAIR_SOLVER',
    });
  }
}
