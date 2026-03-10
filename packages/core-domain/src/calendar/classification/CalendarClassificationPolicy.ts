import {
  CalendarEventKind,
  CalendarEventScopeType,
  CalendarConstraintLevel,
} from '../types';

export interface ClassificationRule {
  scopeType: CalendarEventScopeType;
  kind: CalendarEventKind;
  level: CalendarConstraintLevel;
  reason: string;
  confidence: number;
}

/**
 * Default classification policy mapping scope+kind to constraint level.
 */
const CLASSIFICATION_RULES: ClassificationRule[] = [
  // HARD
  { scopeType: 'CHILD', kind: 'SCHOOL', level: 'HARD', reason: 'Child school commitment', confidence: 0.95 },
  { scopeType: 'CHILD', kind: 'DAYCARE', level: 'HARD', reason: 'Child daycare commitment', confidence: 0.95 },
  { scopeType: 'CHILD', kind: 'MEDICAL', level: 'HARD', reason: 'Child medical appointment', confidence: 0.90 },
  { scopeType: 'FAMILY', kind: 'CLOSURE', level: 'HARD', reason: 'Closure affecting required care', confidence: 0.90 },
  { scopeType: 'CHILD', kind: 'CLOSURE', level: 'HARD', reason: 'School/daycare closure', confidence: 0.90 },

  // STRONG
  { scopeType: 'CHILD', kind: 'ACTIVITY', level: 'STRONG', reason: 'Child activity commitment', confidence: 0.85 },
  { scopeType: 'PARENT', kind: 'TRAVEL', level: 'STRONG', reason: 'Parent travel', confidence: 0.85 },
  { scopeType: 'PARENT', kind: 'WORK', level: 'STRONG', reason: 'Parent work commitment', confidence: 0.80 },
  { scopeType: 'PARENT', kind: 'MEDICAL', level: 'STRONG', reason: 'Parent medical appointment', confidence: 0.80 },
  { scopeType: 'FAMILY', kind: 'HOLIDAY', level: 'STRONG', reason: 'Family holiday', confidence: 0.85 },

  // SOFT
  { scopeType: 'FAMILY', kind: 'INFORMATIONAL', level: 'SOFT', reason: 'Informational family event', confidence: 0.70 },
  { scopeType: 'FAMILY', kind: 'OTHER', level: 'SOFT', reason: 'Unclassified family event', confidence: 0.60 },
  { scopeType: 'PARENT', kind: 'OTHER', level: 'SOFT', reason: 'Unclassified parent event', confidence: 0.60 },
  { scopeType: 'CHILD', kind: 'OTHER', level: 'SOFT', reason: 'Unclassified child event', confidence: 0.60 },
  { scopeType: 'PARENT', kind: 'INFORMATIONAL', level: 'SOFT', reason: 'Informational parent event', confidence: 0.70 },
  { scopeType: 'CHILD', kind: 'INFORMATIONAL', level: 'SOFT', reason: 'Informational child event', confidence: 0.70 },
];

export function getClassificationRule(
  scopeType: CalendarEventScopeType,
  kind: CalendarEventKind,
): ClassificationRule {
  const match = CLASSIFICATION_RULES.find(
    r => r.scopeType === scopeType && r.kind === kind,
  );

  if (match) return match;

  // Fallback: unknown combination defaults to SOFT
  return {
    scopeType,
    kind,
    level: 'SOFT',
    reason: `No specific rule for ${scopeType}/${kind}`,
    confidence: 0.50,
  };
}
