import { ExternalCalendarEvent, CalendarEventKind } from '../types';

interface KindRule {
  keywords: string[];
  kind: CalendarEventKind;
}

const KIND_RULES: KindRule[] = [
  // Closure rules first — "no school" / "snow day" must match before generic "school"
  { keywords: ['closed', 'closure', 'cancelled', 'no school', 'snow day'], kind: 'CLOSURE' },
  { keywords: ['daycare', 'nursery', 'preschool', 'childcare'], kind: 'DAYCARE' },
  { keywords: ['school', 'class', 'homework', 'teacher', 'parent-teacher'], kind: 'SCHOOL' },
  { keywords: ['flight', 'travel', 'trip', 'airport', 'hotel', 'vacation'], kind: 'TRAVEL' },
  { keywords: ['soccer', 'practice', 'lesson', 'recital', 'rehearsal', 'game', 'swim', 'ballet', 'piano', 'karate', 'gymnastics', 'tutoring'], kind: 'ACTIVITY' },
  { keywords: ['work', 'shift', 'meeting', 'conference', 'office'], kind: 'WORK' },
  { keywords: ['doctor', 'dentist', 'therapy', 'appointment', 'medical', 'checkup', 'pediatrician'], kind: 'MEDICAL' },
  { keywords: ['holiday', 'christmas', 'thanksgiving', 'easter', 'new year', 'independence day', 'memorial day', 'labor day'], kind: 'HOLIDAY' },
];

/**
 * Deterministic keyword-based event kind inference.
 */
export class CalendarEventKindInferer {
  inferKind(input: { event: ExternalCalendarEvent }): CalendarEventKind {
    const text = `${input.event.title} ${input.event.description ?? ''}`.toLowerCase();

    for (const rule of KIND_RULES) {
      for (const keyword of rule.keywords) {
        if (text.includes(keyword)) {
          return rule.kind;
        }
      }
    }

    // Check metadata hints
    if (input.event.metadata?.kind && typeof input.event.metadata.kind === 'string') {
      const metaKind = input.event.metadata.kind.toUpperCase();
      const validKinds: CalendarEventKind[] = [
        'WORK', 'TRAVEL', 'SCHOOL', 'ACTIVITY', 'DAYCARE',
        'HOLIDAY', 'CLOSURE', 'MEDICAL', 'INFORMATIONAL', 'OTHER',
      ];
      if (validKinds.includes(metaKind as CalendarEventKind)) {
        return metaKind as CalendarEventKind;
      }
    }

    return 'OTHER';
  }
}
