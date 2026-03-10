import { describe, it, expect, vi } from 'vitest';
import { ProposalOverlayCoordinator, IDisruptionOverlayRepository } from '../core/ProposalOverlayCoordinator';

describe('ProposalOverlayCoordinator', () => {
  it('returns empty when no overlay repo', async () => {
    const coordinator = new ProposalOverlayCoordinator(null);

    const result = await coordinator.resolveAcceptedRepairOverlays({
      proposalId: 'p-1',
      baseScheduleVersionId: 'sv-1',
      resolvedAt: '2026-03-05T10:00:00Z',
    });

    expect(result).toEqual([]);
  });

  it('resolves matching overlays in deterministic order', async () => {
    const overlays = [
      { id: 'ov-2', scheduleVersionId: 'sv-1', childId: 'c1', date: '2026-03-03', assignedParentId: 'pB', type: 'ILLNESS', reason: 'sick' },
      { id: 'ov-1', scheduleVersionId: 'sv-1', childId: 'c1', date: '2026-03-01', assignedParentId: 'pB', type: 'ILLNESS', reason: 'sick' },
    ];

    const repo: IDisruptionOverlayRepository = {
      findByScheduleVersionId: vi.fn(async () => overlays),
      resolveOverlays: vi.fn(async () => {}),
    };

    const coordinator = new ProposalOverlayCoordinator(repo);

    const result = await coordinator.resolveAcceptedRepairOverlays({
      proposalId: 'p-1',
      baseScheduleVersionId: 'sv-1',
      resolvedAt: '2026-03-05T10:00:00Z',
    });

    // Sorted by date then id
    expect(result).toEqual(['ov-1', 'ov-2']);
    expect(repo.resolveOverlays).toHaveBeenCalledWith(
      ['ov-1', 'ov-2'],
      expect.any(Date),
    );
  });

  it('returns empty when no overlays found', async () => {
    const repo: IDisruptionOverlayRepository = {
      findByScheduleVersionId: vi.fn(async () => []),
      resolveOverlays: vi.fn(async () => {}),
    };

    const coordinator = new ProposalOverlayCoordinator(repo);

    const result = await coordinator.resolveAcceptedRepairOverlays({
      proposalId: 'p-1',
      baseScheduleVersionId: 'sv-1',
      resolvedAt: '2026-03-05T10:00:00Z',
    });

    expect(result).toEqual([]);
    expect(repo.resolveOverlays).not.toHaveBeenCalled();
  });
});
