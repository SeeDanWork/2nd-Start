import { AvailabilityConstraintProvider, UnavailableAssignment, PlanningWindow } from '../types';

/**
 * No-op availability constraint provider.
 * Returns no unavailable assignments — all parents are available.
 * Placeholder until availability ingestion is modeled.
 */
export class NoOpAvailabilityProvider implements AvailabilityConstraintProvider {
  getUnavailableAssignments(
    _familyId: string,
    _parentIds: string[],
    _childIds: string[],
    _window: PlanningWindow,
  ): UnavailableAssignment[] {
    return [];
  }
}
