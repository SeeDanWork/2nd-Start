import { ProposalArtifact } from '../types';

/**
 * Repository interface for overlay resolution during proposal acceptance.
 */
export interface IDisruptionOverlayRepository {
  findByScheduleVersionId(scheduleVersionId: string): Promise<Array<{
    id: string;
    scheduleVersionId: string;
    childId: string;
    date: string;
    assignedParentId: string;
    type: string;
    reason: string;
  }>>;
  resolveOverlays(overlayIds: string[], resolvedAt: Date): Promise<void>;
}

/**
 * Coordinates overlay resolution during repair proposal acceptance.
 */
export class ProposalOverlayCoordinator {
  constructor(private readonly overlayRepo: IDisruptionOverlayRepository | null) {}

  /**
   * Resolve overlays associated with an accepted repair proposal.
   * Returns resolved overlay IDs in deterministic order.
   */
  async resolveAcceptedRepairOverlays(input: {
    proposalId: string;
    baseScheduleVersionId: string;
    resolvedAt: string;
  }): Promise<string[]> {
    if (!this.overlayRepo) return [];

    const overlays = await this.overlayRepo.findByScheduleVersionId(input.baseScheduleVersionId);
    if (overlays.length === 0) return [];

    // Sort deterministically
    const sorted = [...overlays].sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      if (dc !== 0) return dc;
      return a.id.localeCompare(b.id);
    });

    const overlayIds = sorted.map(o => o.id);
    await this.overlayRepo.resolveOverlays(overlayIds, new Date(input.resolvedAt));

    return overlayIds;
  }
}
