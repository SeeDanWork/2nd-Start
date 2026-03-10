import { ObservationEvidenceExtractor } from './ObservationEvidenceExtractor';
import { BehaviorObservationWindow, ObservationEvidenceRecord } from '../types';

export interface OverlayCoverageRecord {
  overlayId: string;
  familyId: string;
  date: string;
  childId: string;
  assignedParentId: string;
  disruptionType: string;
  reason?: string;
}

/**
 * Extracts evidence about overlay coverage patterns.
 * Detects repeated school closure coverage or disruption handling
 * by the same parent.
 */
export class OverlayCoverageEvidenceExtractor implements ObservationEvidenceExtractor {
  readonly evidenceType = 'OVERLAY_COVERAGE';

  constructor(private readonly overlays: OverlayCoverageRecord[]) {}

  extractEvidence(input: {
    window: BehaviorObservationWindow;
  }): ObservationEvidenceRecord[] {
    const { window } = input;

    const filtered = this.overlays
      .filter(o =>
        o.familyId === window.familyId &&
        o.date >= window.startDate &&
        o.date <= window.endDate,
      )
      .sort((a, b) => a.date.localeCompare(b.date) || a.overlayId.localeCompare(b.overlayId));

    return filtered.map(overlay => ({
      evidenceId: `overlay-${overlay.overlayId}`,
      familyId: window.familyId,
      evidenceType: this.evidenceType,
      date: overlay.date,
      childId: overlay.childId,
      parentId: overlay.assignedParentId,
      relatedEntityType: 'OVERLAY',
      relatedEntityId: overlay.overlayId,
      data: {
        disruptionType: overlay.disruptionType,
        reason: overlay.reason,
        assignedParentId: overlay.assignedParentId,
      },
      createdAt: overlay.date + 'T00:00:00Z',
    }));
  }
}
