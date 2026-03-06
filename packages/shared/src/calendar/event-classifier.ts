/**
 * Deterministic event classification: map calendar event summaries
 * to DisruptionEventType values using keyword matching.
 *
 * Precedence: first matching rule wins (rules ordered by specificity).
 */

import { DisruptionEventType } from '../enums';

export interface ClassificationResult {
  eventType: DisruptionEventType;
  confidence: number;
  matchedRule: string;
}

interface ClassificationRule {
  name: string;
  keywords: string[];
  excludeKeywords?: string[];
  eventType: DisruptionEventType;
  confidence: number;
}

/**
 * Rules ordered by specificity (most specific first).
 * All matching is case-insensitive against the lowercased summary.
 */
const CLASSIFICATION_RULES: ClassificationRule[] = [
  // Early dismissal (before school_closed to avoid false match on "school")
  {
    name: 'early_dismissal',
    keywords: ['early dismissal', 'early release', 'half day', 'half-day', 'minimum day', 'shortened day'],
    eventType: DisruptionEventType.SCHOOL_HALF_DAY,
    confidence: 0.9,
  },
  // Teacher workdays / professional development (school closed for students)
  {
    name: 'teacher_workday',
    keywords: ['teacher workday', 'teacher work day', 'professional development', 'staff development', 'in-service', 'inservice', 'teacher planning'],
    eventType: DisruptionEventType.SCHOOL_CLOSED,
    confidence: 0.9,
  },
  // Parent-teacher conference
  {
    name: 'conference',
    keywords: ['parent-teacher', 'parent teacher', 'conference day', 'conferences'],
    excludeKeywords: ['open house'],
    eventType: DisruptionEventType.SCHOOL_HALF_DAY,
    confidence: 0.8,
  },
  // Weather / emergency closure (before school_closed — "snow day" is more specific)
  {
    name: 'weather_closure',
    keywords: ['snow day', 'weather closure', 'emergency closure', 'school cancelled', 'school canceled'],
    eventType: DisruptionEventType.WEATHER_EMERGENCY,
    confidence: 0.85,
  },
  // School breaks (multi-day)
  {
    name: 'school_break',
    keywords: ['spring break', 'winter break', 'fall break', 'thanksgiving break', 'mid-winter break', 'february break', 'recess'],
    eventType: DisruptionEventType.BREAK,
    confidence: 0.95,
  },
  // Summer
  {
    name: 'summer',
    keywords: ['summer break', 'summer vacation', 'last day of school', 'end of school'],
    eventType: DisruptionEventType.SUMMER_PERIOD,
    confidence: 0.9,
  },
  // Public holidays (before school_closed — "memorial day" is more specific than "no school")
  {
    name: 'public_holiday',
    keywords: [
      'martin luther king', 'mlk', 'presidents day', "president's day",
      'memorial day', 'independence day', 'labor day', 'columbus day',
      'veterans day', "veteran's day", 'thanksgiving', 'christmas',
      'new year', "new year's", 'juneteenth', 'election day',
    ],
    eventType: DisruptionEventType.PUBLIC_HOLIDAY,
    confidence: 0.85,
  },
  // Explicit school closed
  {
    name: 'school_closed',
    keywords: ['no school', 'school closed', 'schools closed', 'no classes', 'student holiday', 'students off'],
    eventType: DisruptionEventType.SCHOOL_CLOSED,
    confidence: 0.9,
  },
  // Daycare closed
  {
    name: 'daycare_closed',
    keywords: ['daycare closed', 'childcare closed', 'center closed', 'preschool closed'],
    eventType: DisruptionEventType.SCHOOL_CLOSED,
    confidence: 0.9,
  },
  // Camp / activity
  {
    name: 'camp',
    keywords: ['camp week', 'summer camp', 'day camp'],
    eventType: DisruptionEventType.CAMP_WEEK,
    confidence: 0.8,
  },
  // School trip
  {
    name: 'school_trip',
    keywords: ['field trip', 'school trip', 'class trip'],
    eventType: DisruptionEventType.SCHOOL_TRIP,
    confidence: 0.7,
  },
];

/**
 * Classify a calendar event summary into a DisruptionEventType.
 * Returns null if no rule matches (event is not schedule-relevant).
 */
export function classifyEvent(summary: string): ClassificationResult | null {
  const lower = summary.toLowerCase();

  for (const rule of CLASSIFICATION_RULES) {
    // Check exclude keywords first
    if (rule.excludeKeywords?.some((kw) => lower.includes(kw))) {
      continue;
    }

    // Check if any keyword matches
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return {
        eventType: rule.eventType,
        confidence: rule.confidence,
        matchedRule: rule.name,
      };
    }
  }

  return null;
}

/**
 * Returns all classification rules (for testing/inspection).
 */
export function getClassificationRules(): readonly ClassificationRule[] {
  return CLASSIFICATION_RULES;
}
