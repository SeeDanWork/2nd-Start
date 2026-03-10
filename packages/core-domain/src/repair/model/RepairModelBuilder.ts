import { NormalizedRepairInput, BuiltRepairModel, RepairAssignmentVariable } from '../types';
import { RepairModelBuildError } from '../errors';

/**
 * Builds the constraint model for repair solving.
 *
 * - Decision variables only for dates inside repair window
 * - Overlay dates are fixed (cannot change)
 * - Holiday-assigned dates are fixed
 * - Remaining dates can vary for restitution
 *
 * Variable creation order: date ascending, childId ascending, parentId ascending
 */
export function buildRepairModel(input: NormalizedRepairInput): BuiltRepairModel {
  const variables: RepairAssignmentVariable[] = [];
  const variablesBySlot = new Map<string, number[]>();
  const variableByIndex = new Map<number, RepairAssignmentVariable>();
  const fixedVariables = new Set<number>();
  const overlayFixedVariables = new Set<number>();

  let varIndex = 0;

  for (const day of input.days) {
    for (const childId of input.childIds) {
      const slotKey = `${day.date}:${childId}`;
      const slotVarIndices: number[] = [];

      for (const parentId of input.parentIds) {
        const v: RepairAssignmentVariable = {
          date: day.date,
          childId,
          parentId,
          index: varIndex,
        };
        variables.push(v);
        variableByIndex.set(varIndex, v);
        slotVarIndices.push(varIndex);

        // Check if overlay-fixed
        if (input.overlayFixedSlots.has(slotKey)) {
          const overlaidParent = input.overlaidNightLookup.get(slotKey);
          if (overlaidParent === parentId) {
            overlayFixedVariables.add(varIndex);
            fixedVariables.add(varIndex);
          }
        }

        // Check if holiday-fixed
        const holidayParent = input.fixedHolidayAssignments.get(slotKey);
        if (holidayParent !== undefined && holidayParent === parentId) {
          fixedVariables.add(varIndex);
        }

        varIndex++;
      }

      if (slotVarIndices.length === 0) {
        throw new RepairModelBuildError(`No variables for slot ${slotKey}`);
      }

      variablesBySlot.set(slotKey, slotVarIndices);
    }
  }

  return {
    variables,
    variablesBySlot,
    variableByIndex,
    fixedVariables,
    overlayFixedVariables,
    variableCount: varIndex,
  };
}
