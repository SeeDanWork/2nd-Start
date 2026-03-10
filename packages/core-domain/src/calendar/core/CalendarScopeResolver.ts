import {
  ExternalCalendarEvent,
  CalendarFamilyContext,
  CalendarEventScopeType,
} from '../types';

export interface ScopeResolutionResult {
  scopeType: CalendarEventScopeType;
  parentId?: string;
  childId?: string;
  unresolvedTokens?: string[];
}

/**
 * Resolves event scope to PARENT, CHILD, or FAMILY using family context.
 */
export class CalendarScopeResolver {
  resolveScope(input: {
    event: ExternalCalendarEvent;
    familyContext: CalendarFamilyContext;
  }): ScopeResolutionResult {
    const { event, familyContext } = input;
    const text = `${event.title} ${event.description ?? ''}`.toLowerCase();
    const unresolvedTokens: string[] = [];

    // 1. Try exact parent name match
    const matchedParents = familyContext.parents.filter(p =>
      text.includes(p.name.toLowerCase().trim()),
    );
    if (matchedParents.length === 1) {
      return {
        scopeType: 'PARENT',
        parentId: matchedParents[0].id,
      };
    }
    if (matchedParents.length > 1) {
      unresolvedTokens.push(...matchedParents.map(p => p.name));
      // Ambiguous parent — fall through to check children
    }

    // 2. Try exact child name match
    const matchedChildren = familyContext.children.filter(c =>
      text.includes(c.name.toLowerCase().trim()),
    );
    if (matchedChildren.length === 1) {
      return {
        scopeType: 'CHILD',
        childId: matchedChildren[0].id,
      };
    }
    if (matchedChildren.length > 1) {
      unresolvedTokens.push(...matchedChildren.map(c => c.name));
    }

    // 3. Check metadata for explicit scope hints
    if (event.metadata) {
      if (event.metadata.parentId && typeof event.metadata.parentId === 'string') {
        const parent = familyContext.parents.find(p => p.id === event.metadata!.parentId);
        if (parent) {
          return { scopeType: 'PARENT', parentId: parent.id };
        }
        unresolvedTokens.push(event.metadata.parentId as string);
      }
      if (event.metadata.childId && typeof event.metadata.childId === 'string') {
        const child = familyContext.children.find(c => c.id === event.metadata!.childId);
        if (child) {
          return { scopeType: 'CHILD', childId: child.id };
        }
        unresolvedTokens.push(event.metadata.childId as string);
      }
    }

    // 4. Default to FAMILY when no specific scope resolved
    return {
      scopeType: 'FAMILY',
      unresolvedTokens: unresolvedTokens.length > 0 ? unresolvedTokens : undefined,
    };
  }
}
