import {
  NormalizedSolverInput,
  BuiltScheduleModel,
  CandidateNight,
  CandidateExchange,
} from '../types';
import { SolverCandidateExtractionError } from '../errors';

/**
 * Extracts candidate nights and exchanges from a solved assignment.
 *
 * Exchange inference: when ownership for a child changes between consecutive
 * dates, an exchange is created on the later date.
 */
export function extractCandidate(
  assignment: Map<number, number>, // variable index -> 0 or 1
  model: BuiltScheduleModel,
  input: NormalizedSolverInput,
): { nights: CandidateNight[]; exchanges: CandidateExchange[] } {
  const nights: CandidateNight[] = [];

  // Extract nights from assignment in deterministic order
  for (const day of input.days) {
    for (const childId of input.childIds) {
      const slotKey = `${day.date}:${childId}`;
      const varIndices = model.variablesBySlot.get(slotKey);
      if (!varIndices) {
        throw new SolverCandidateExtractionError(`No variables for slot ${slotKey}`);
      }

      let assignedParent: string | null = null;
      for (const vi of varIndices) {
        if (assignment.get(vi) === 1) {
          const v = model.variableByIndex.get(vi)!;
          if (assignedParent !== null) {
            throw new SolverCandidateExtractionError(
              `Multiple parents assigned for ${slotKey}`,
            );
          }
          assignedParent = v.parentId;
        }
      }

      if (assignedParent === null) {
        throw new SolverCandidateExtractionError(
          `No parent assigned for ${slotKey}`,
        );
      }

      nights.push({ date: day.date, childId, parentId: assignedParent });
    }
  }

  // Infer exchanges from ownership transitions
  const exchanges = inferExchanges(nights, input);

  return { nights, exchanges };
}

function inferExchanges(
  nights: CandidateNight[],
  input: NormalizedSolverInput,
): CandidateExchange[] {
  const exchanges: CandidateExchange[] = [];

  // Group nights by child for transition detection
  const nightsByChild = new Map<string, CandidateNight[]>();
  for (const night of nights) {
    if (!nightsByChild.has(night.childId)) {
      nightsByChild.set(night.childId, []);
    }
    nightsByChild.get(night.childId)!.push(night);
  }

  for (const childId of input.childIds) {
    const childNights = nightsByChild.get(childId);
    if (!childNights || childNights.length < 2) continue;

    // Nights are already in date order from extraction
    for (let i = 1; i < childNights.length; i++) {
      const prev = childNights[i - 1];
      const curr = childNights[i];
      if (prev.parentId !== curr.parentId) {
        exchanges.push({
          date: curr.date,
          childId,
          fromParentId: prev.parentId,
          toParentId: curr.parentId,
          time: null,
          location: null,
        });
      }
    }
  }

  // Sort deterministically: date, childId
  exchanges.sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    return dc !== 0 ? dc : a.childId.localeCompare(b.childId);
  });

  return exchanges;
}
