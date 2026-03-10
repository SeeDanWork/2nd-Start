import {
  CalendarProjectionInput,
  CalendarTranslationResult,
  ClassifiedCalendarEvent,
} from '../types';
import { CalendarConstraintTranslator } from './CalendarConstraintTranslator';

/**
 * Main calendar-to-solver projection API.
 */
export class CalendarProjectionService {
  private readonly translator: CalendarConstraintTranslator;

  constructor(translator?: CalendarConstraintTranslator) {
    this.translator = translator ?? new CalendarConstraintTranslator();
  }

  projectWindow(input: {
    familyId: string;
    windowStart: string;
    windowEnd: string;
    parentIds: string[];
    childIds: string[];
    events: ClassifiedCalendarEvent[];
  }): CalendarTranslationResult {
    return this.translator.translate({
      familyId: input.familyId,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      parentIds: input.parentIds,
      childIds: input.childIds,
      events: input.events,
    });
  }
}
