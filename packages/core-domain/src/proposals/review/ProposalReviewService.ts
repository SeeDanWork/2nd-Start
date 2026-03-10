import { ProposalReviewBundle, ProposalArtifact, ProposalOrigin } from '../types';
import { ProposalReviewError } from '../errors';
import { ProposalService } from '../../services/ProposalService';
import { ScheduleVersionService } from '../../services/ScheduleVersionService';
import { diffProposalAgainstBase } from '../../diff/ScheduleDiffService';
import { buildScoreSummary } from './ProposalScoreSummaryBuilder';
import { buildFairnessSummary } from './ProposalFairnessSummaryBuilder';
import { IProposalRepository } from '../../repositories/IProposalRepository';
import { IProposalScheduleRepository } from '../../repositories/IProposalScheduleRepository';
import { Proposal } from '../../models/Proposal';
import { ProposalSchedule } from '../../models/ProposalSchedule';

export interface ProposalReviewServiceDeps {
  proposalService: ProposalService;
  scheduleVersionService: ScheduleVersionService;
  proposalRepo: IProposalRepository;
  proposalScheduleRepo: IProposalScheduleRepository;
}

/**
 * Builds deterministic review bundles for proposals.
 */
export class ProposalReviewService {
  constructor(private readonly deps: ProposalReviewServiceDeps) {}

  async getReviewBundle(proposalId: string): Promise<ProposalReviewBundle> {
    // Load proposal snapshot
    const snapshot = await this.deps.proposalService.getProposalSnapshot(proposalId);
    const proposal = await this.deps.proposalRepo.findById(proposalId);
    if (!proposal) {
      throw new ProposalReviewError(`Proposal ${proposalId} not found`);
    }

    const schedule = await this.deps.proposalScheduleRepo.findByProposalId(proposalId);
    if (!schedule) {
      throw new ProposalReviewError(`Proposal ${proposalId} has no schedule`);
    }

    // Load base schedule snapshot
    const baseSnapshot = await this.deps.scheduleVersionService.getScheduleSnapshot(
      proposal.baseScheduleVersionId,
    );

    // Diff
    const diff = diffProposalAgainstBase(baseSnapshot, snapshot);

    // Build summaries
    const scoreSummary = buildScoreSummary(schedule.scoreBreakdown as unknown as Record<string, unknown>);
    const fairnessSummary = buildFairnessSummary(schedule.fairnessProjection as unknown as Record<string, unknown>);

    return {
      proposalId,
      proposalStatus: proposal.status,
      baseScheduleVersionId: proposal.baseScheduleVersionId,
      proposalScheduleId: schedule.id,
      diff,
      scoreSummary,
      fairnessSummary,
      artifacts: [],
      metadata: {
        generatedAt: new Date().toISOString(),
        origin: 'BASELINE_SOLVER' as ProposalOrigin,
      },
    };
  }

  async getReviewBundlesForBaseSchedule(input: {
    baseScheduleVersionId: string;
  }): Promise<ProposalReviewBundle[]> {
    const proposals = await this.deps.proposalRepo.findPendingByBaseVersion(
      input.baseScheduleVersionId,
    );

    // Sort deterministically
    const sorted = [...proposals].sort((a, b) => {
      const tc = a.createdAt.getTime() - b.createdAt.getTime();
      if (tc !== 0) return tc;
      return a.id.localeCompare(b.id);
    });

    const bundles: ProposalReviewBundle[] = [];
    for (const proposal of sorted) {
      const bundle = await this.getReviewBundle(proposal.id);
      bundles.push(bundle);
    }

    return bundles;
  }
}
