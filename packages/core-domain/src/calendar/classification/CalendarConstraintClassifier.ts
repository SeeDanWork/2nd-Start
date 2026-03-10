import {
  NormalizedCalendarEvent,
  ClassifiedCalendarEvent,
} from '../types';
import { getClassificationRule } from './CalendarClassificationPolicy';

/**
 * Classifies normalized calendar events into HARD / STRONG / SOFT constraint levels.
 */
export class CalendarConstraintClassifier {
  classify(input: { event: NormalizedCalendarEvent }): ClassifiedCalendarEvent {
    const { event } = input;
    const rule = getClassificationRule(event.scopeType, event.kind);

    return {
      ...event,
      constraintLevel: rule.level,
      classificationReason: rule.reason,
      confidence: rule.confidence,
    };
  }
}
