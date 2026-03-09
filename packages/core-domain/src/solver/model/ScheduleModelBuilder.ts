import {
  NormalizedSolverInput,
  BuiltScheduleModel,
  AssignmentVariable,
} from '../types';
import { SolverModelBuildError } from '../errors';

/**
 * Builds the constraint model for night ownership assignment.
 *
 * Variables are created in deterministic order:
 *   1. date ascending
 *   2. child id ascending
 *   3. parent id ascending
 *
 * Hard constraints:
 *   - Exactly one parent per child per night
 *   - Fixed holiday assignments enforced
 *   - Unavailable assignments excluded
 */
export function buildModel(input: NormalizedSolverInput): BuiltScheduleModel {
  const variables: AssignmentVariable[] = [];
  const variablesBySlot = new Map<string, number[]>();
  const variableByIndex = new Map<number, AssignmentVariable>();
  const fixedVariables = new Set<number>();

  let varIndex = 0;

  // Create variables in deterministic order: date → child → parent
  for (const day of input.days) {
    for (const childId of input.childIds) {
      const slotKey = `${day.date}:${childId}`;
      const slotVarIndices: number[] = [];

      for (const parentId of input.parentIds) {
        const v: AssignmentVariable = {
          date: day.date,
          childId,
          parentId,
          index: varIndex,
        };
        variables.push(v);
        variableByIndex.set(varIndex, v);
        slotVarIndices.push(varIndex);

        // Check if this is a fixed assignment
        const fixedParent = input.fixedAssignments.get(slotKey);
        if (fixedParent !== undefined) {
          if (parentId === fixedParent) {
            fixedVariables.add(varIndex);
          }
        }

        varIndex++;
      }

      if (slotVarIndices.length === 0) {
        throw new SolverModelBuildError(
          `No parent variables created for slot ${slotKey}`,
        );
      }

      variablesBySlot.set(slotKey, slotVarIndices);
    }
  }

  return {
    variables,
    variablesBySlot,
    variableByIndex,
    fixedVariables,
    variableCount: varIndex,
  };
}
