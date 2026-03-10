import {
  IncomingMessage,
  ValidatedIntentCandidate,
  ExtractionFamilyContext,
  EntityResolutionResult,
  InterpretationFailure,
} from '../types';

/**
 * Resolves parent/child/policy entity references from message + payload.
 */
export class EntityReferenceResolver {
  resolveEntities(input: {
    message: IncomingMessage;
    candidate: ValidatedIntentCandidate;
    familyContext: ExtractionFamilyContext;
  }): EntityResolutionResult {
    const resolved: EntityResolutionResult = {
      resolved: {},
      ambiguities: [],
    };

    const text = input.message.text.toLowerCase();
    const payload = input.candidate.payload;

    // Resolve parent references
    const parentResults = this.resolveParentReferences(text, payload, input.familyContext);
    if (parentResults.ids.length > 0) {
      resolved.resolved.parentIds = parentResults.ids;
    }
    resolved.ambiguities.push(...parentResults.ambiguities);

    // Resolve child references
    const childResults = this.resolveChildReferences(text, payload, input.familyContext);
    if (childResults.ids.length > 0) {
      resolved.resolved.childIds = childResults.ids;
    }
    resolved.ambiguities.push(...childResults.ambiguities);

    // Collect unresolved tokens
    const unresolvedTokens: string[] = [];

    // Check payload for parent ID references that don't match context
    if (payload.requestedWithParentId && typeof payload.requestedWithParentId === 'string') {
      const pid = payload.requestedWithParentId;
      const found = input.familyContext.parents.find(p => p.id === pid);
      if (!found) {
        // Try name match
        const nameMatch = this.findParentByName(pid, input.familyContext);
        if (nameMatch.length === 1) {
          resolved.resolved.parentIds = [
            ...(resolved.resolved.parentIds ?? []),
            nameMatch[0],
          ];
        } else if (nameMatch.length > 1) {
          resolved.ambiguities.push({
            code: 'AMBIGUOUS_PARENT_REFERENCE',
            message: `"${pid}" matches multiple parents`,
            details: { candidates: nameMatch },
          });
        } else {
          unresolvedTokens.push(pid);
        }
      }
    }

    // Check payload for child IDs
    if (Array.isArray(payload.childIds)) {
      for (const cid of payload.childIds) {
        if (typeof cid !== 'string') continue;
        const found = input.familyContext.children.find(c => c.id === cid);
        if (!found) {
          const nameMatch = this.findChildByName(cid, input.familyContext);
          if (nameMatch.length === 1) {
            if (!resolved.resolved.childIds) resolved.resolved.childIds = [];
            resolved.resolved.childIds.push(nameMatch[0]);
          } else if (nameMatch.length > 1) {
            resolved.ambiguities.push({
              code: 'AMBIGUOUS_CHILD_REFERENCE',
              message: `"${cid}" matches multiple children`,
              details: { candidates: nameMatch },
            });
          } else {
            unresolvedTokens.push(cid);
          }
        }
      }
    }

    if (unresolvedTokens.length > 0) {
      resolved.resolved.unresolvedTokens = unresolvedTokens;
    }

    return resolved;
  }

  private resolveParentReferences(
    text: string,
    payload: Record<string, unknown>,
    context: ExtractionFamilyContext,
  ): { ids: string[]; ambiguities: InterpretationFailure[] } {
    const ids: string[] = [];
    const ambiguities: InterpretationFailure[] = [];

    for (const parent of context.parents) {
      const normalizedName = parent.name.toLowerCase().trim();
      if (text.includes(normalizedName)) {
        ids.push(parent.id);
      }
    }

    return { ids, ambiguities };
  }

  private resolveChildReferences(
    text: string,
    payload: Record<string, unknown>,
    context: ExtractionFamilyContext,
  ): { ids: string[]; ambiguities: InterpretationFailure[] } {
    const ids: string[] = [];
    const ambiguities: InterpretationFailure[] = [];

    for (const child of context.children) {
      const normalizedName = child.name.toLowerCase().trim();
      if (text.includes(normalizedName)) {
        ids.push(child.id);
      }
    }

    return { ids, ambiguities };
  }

  private findParentByName(token: string, context: ExtractionFamilyContext): string[] {
    const normalized = token.toLowerCase().trim();
    return context.parents
      .filter(p => p.name.toLowerCase().trim() === normalized)
      .map(p => p.id);
  }

  private findChildByName(token: string, context: ExtractionFamilyContext): string[] {
    const normalized = token.toLowerCase().trim();
    return context.children
      .filter(c => c.name.toLowerCase().trim() === normalized)
      .map(c => c.id);
  }
}
