import { ScenarioExecutionContext } from '../types';
import { ScenarioExecutionError } from '../errors';

/**
 * Resolves fixture names (parent/child) to seeded IDs deterministically.
 */
export class ScenarioNameResolver {
  resolveParentId(context: ScenarioExecutionContext, parentName: string): string {
    const id = context.parentIdsByName[parentName];
    if (!id) {
      throw new ScenarioExecutionError(
        `Cannot resolve parent name "${parentName}". Known: ${Object.keys(context.parentIdsByName).join(', ')}`,
      );
    }
    return id;
  }

  resolveChildId(context: ScenarioExecutionContext, childName: string): string {
    const id = context.childIdsByName[childName];
    if (!id) {
      throw new ScenarioExecutionError(
        `Cannot resolve child name "${childName}". Known: ${Object.keys(context.childIdsByName).join(', ')}`,
      );
    }
    return id;
  }

  resolveParentName(context: ScenarioExecutionContext, parentId: string): string {
    for (const [name, id] of Object.entries(context.parentIdsByName)) {
      if (id === parentId) return name;
    }
    throw new ScenarioExecutionError(`Cannot resolve parent id "${parentId}" to name`);
  }

  resolveChildName(context: ScenarioExecutionContext, childId: string): string {
    for (const [name, id] of Object.entries(context.childIdsByName)) {
      if (id === childId) return name;
    }
    throw new ScenarioExecutionError(`Cannot resolve child id "${childId}" to name`);
  }
}
