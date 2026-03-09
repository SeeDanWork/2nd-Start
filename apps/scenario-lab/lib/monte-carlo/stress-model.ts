// ── Custody Logistics Stress Model ──────────────────────────
// Real-world disruption frequencies for shared parenting.
// Sources: pediatric illness rates, school closure data,
// DOT travel statistics, employment surveys.
//
// All rates are per-child-per-week unless noted.

export interface DisruptionRate {
  type: string;
  category: string;
  weekly_probability: number;      // probability per week
  duration_days: number;           // typical duration
  duration_variance: number;       // +/- days
  seasonal_modifier?: Record<string, number>; // season → multiplier
  age_modifier?: (age: number) => number;     // child age → multiplier
  requires_parent?: boolean;       // event targets a specific parent
  description: string;
}

// ── Season Detection ──

type Season = 'winter' | 'spring' | 'summer' | 'fall';

export function getSeason(weekOfYear: number): Season {
  if (weekOfYear <= 11 || weekOfYear >= 49) return 'winter';
  if (weekOfYear <= 22) return 'spring';
  if (weekOfYear <= 35) return 'summer';
  return 'fall';
}

// ── Real-World Disruption Frequencies ──

export const DISRUPTION_RATES: DisruptionRate[] = [
  // ── Health ──
  {
    type: 'child_sick',
    category: 'health',
    weekly_probability: 0.06,   // ~3x/year per child
    duration_days: 2,
    duration_variance: 2,
    seasonal_modifier: { winter: 2.0, spring: 1.2, summer: 0.5, fall: 1.0 },
    age_modifier: (age) => age < 5 ? 1.8 : age < 10 ? 1.0 : 0.6,
    description: 'Child illness (cold, flu, stomach bug)',
  },
  {
    type: 'parent_sick',
    category: 'health',
    weekly_probability: 0.03,   // ~1.5x/year per parent
    duration_days: 2,
    duration_variance: 1,
    seasonal_modifier: { winter: 1.8, spring: 1.0, summer: 0.5, fall: 1.0 },
    requires_parent: true,
    description: 'Parent too sick to care for child',
  },
  {
    type: 'child_hospitalization',
    category: 'health',
    weekly_probability: 0.002,  // ~1x/10 years
    duration_days: 3,
    duration_variance: 3,
    description: 'Child ER visit or hospitalization',
  },

  // ── School ──
  {
    type: 'school_closed',
    category: 'school',
    weekly_probability: 0.04,   // ~2x/year (weather, teacher days)
    duration_days: 1,
    duration_variance: 1,
    seasonal_modifier: { winter: 2.5, spring: 0.8, summer: 0, fall: 0.5 },
    age_modifier: (age) => age < 5 ? 0 : 1.0, // only school-age
    description: 'Unplanned school closure (weather, facility)',
  },
  {
    type: 'school_trip',
    category: 'school',
    weekly_probability: 0.02,   // ~1x/year
    duration_days: 1,
    duration_variance: 0,
    age_modifier: (age) => age < 5 ? 0 : age < 13 ? 1.0 : 0.5,
    description: 'School field trip requiring consent/logistics',
  },
  {
    type: 'activity_added',
    category: 'school',
    weekly_probability: 0.015,  // ~1x/year, concentrated at season starts
    duration_days: 0,
    duration_variance: 0,
    seasonal_modifier: { winter: 0.5, spring: 1.5, summer: 0.5, fall: 2.0 },
    age_modifier: (age) => age < 4 ? 0.2 : age < 13 ? 1.0 : 1.5,
    description: 'New after-school activity changes pickup logistics',
  },
  {
    type: 'camp_week',
    category: 'school',
    weekly_probability: 0.02,   // ~1x/year, summer only
    duration_days: 5,
    duration_variance: 0,
    seasonal_modifier: { winter: 0, spring: 0, summer: 4.0, fall: 0 },
    age_modifier: (age) => age < 5 ? 0.2 : age < 13 ? 1.0 : 0.3,
    description: 'Summer day camp changes exchange logistics',
  },

  // ── Work ──
  {
    type: 'work_emergency',
    category: 'work',
    weekly_probability: 0.04,   // ~2x/year per parent
    duration_days: 1,
    duration_variance: 0,
    requires_parent: true,
    description: 'Parent cannot pick up due to work emergency',
  },
  {
    type: 'parent_travel',
    category: 'work',
    weekly_probability: 0.03,   // ~1.5x/year
    duration_days: 3,
    duration_variance: 2,
    requires_parent: true,
    description: 'Parent business travel during custody period',
  },

  // ── Logistics ──
  {
    type: 'late_pickup',
    category: 'logistics',
    weekly_probability: 0.08,   // ~4x/year per parent
    duration_days: 0,
    duration_variance: 0,
    requires_parent: true,
    description: 'Parent arrives late for handoff',
  },
  {
    type: 'transport_failure',
    category: 'logistics',
    weekly_probability: 0.01,   // ~0.5x/year
    duration_days: 1,
    duration_variance: 0,
    requires_parent: true,
    description: 'Vehicle breakdown or transport issue',
  },
  {
    type: 'traffic_delay',
    category: 'logistics',
    weekly_probability: 0.05,   // common, ~2.5x/year significant
    duration_days: 0,
    duration_variance: 0,
    requires_parent: true,
    description: 'Heavy traffic makes exchange impractical',
  },

  // ── Travel / Vacation ──
  {
    type: 'vacation_request',
    category: 'travel',
    weekly_probability: 0.015,  // ~1x/year per parent
    duration_days: 5,
    duration_variance: 3,
    seasonal_modifier: { winter: 1.5, spring: 1.5, summer: 3.0, fall: 0.3 },
    requires_parent: true,
    description: 'Parent requests extra days for vacation',
  },
  {
    type: 'flight_delay',
    category: 'travel',
    weekly_probability: 0.005,  // rare, tied to parent_travel
    duration_days: 1,
    duration_variance: 1,
    requires_parent: true,
    description: 'Travel delay causes missed exchange',
  },

  // ── Holidays ──
  {
    type: 'holiday',
    category: 'holiday',
    weekly_probability: 0.02,   // ~1x/year major holiday conflict
    duration_days: 1,
    duration_variance: 0,
    seasonal_modifier: { winter: 4.0, spring: 1.0, summer: 1.0, fall: 2.0 },
    description: 'Holiday falls on exchange day',
  },
  {
    type: 'holiday_extension_request',
    category: 'holiday',
    weekly_probability: 0.01,   // ~0.5x/year
    duration_days: 2,
    duration_variance: 1,
    seasonal_modifier: { winter: 3.0, spring: 1.5, summer: 1.5, fall: 1.0 },
    requires_parent: true,
    description: 'Parent wants extra days around holiday',
  },

  // ── Conflict-Driven ──
  {
    type: 'schedule_swap_request',
    category: 'conflict',
    weekly_probability: 0.06,   // ~3x/year per parent
    duration_days: 0,
    duration_variance: 0,
    requires_parent: true,
    description: 'Parent requests day swap',
  },
  {
    type: 'fairness_complaint',
    category: 'conflict',
    weekly_probability: 0.02,   // ~1x/year
    duration_days: 0,
    duration_variance: 0,
    requires_parent: true,
    description: 'Parent disputes fairness metrics',
  },
  {
    type: 'extra_time_request',
    category: 'conflict',
    weekly_probability: 0.03,   // ~1.5x/year
    duration_days: 0,
    duration_variance: 0,
    requires_parent: true,
    description: 'Parent attempts to gain additional custody time',
  },
];

// ── Event Generator ──

export interface GeneratedEvent {
  type: string;
  category: string;
  day: number;             // day within simulation
  duration: number;
  parent?: 'parent_a' | 'parent_b';
  description: string;
}

/**
 * Generate disruption events for a simulation run.
 * Uses real-world frequencies with seasonal and age adjustments.
 */
export function generateEvents(config: {
  horizon_weeks: number;
  children_ages: number[];
  start_week_of_year: number; // 1-52, for seasonal adjustment
  distance_miles: number;
}): GeneratedEvent[] {
  const events: GeneratedEvent[] = [];
  const totalDays = config.horizon_weeks * 7;

  for (let week = 0; week < config.horizon_weeks; week++) {
    const weekOfYear = ((config.start_week_of_year + week - 1) % 52) + 1;
    const season = getSeason(weekOfYear);

    for (const rate of DISRUPTION_RATES) {
      let prob = rate.weekly_probability;

      // Seasonal modifier
      if (rate.seasonal_modifier) {
        prob *= rate.seasonal_modifier[season] ?? 1.0;
      }

      // Age modifier — use max across children (any child can trigger)
      if (rate.age_modifier && config.children_ages.length > 0) {
        const maxMod = Math.max(...config.children_ages.map(rate.age_modifier));
        prob *= maxMod;
      }

      // Distance modifier for logistics events
      if (rate.category === 'logistics' && config.distance_miles > 20) {
        prob *= 1 + (config.distance_miles - 20) / 50; // increases with distance
      }

      // Roll
      if (Math.random() < prob) {
        const dayInWeek = Math.floor(Math.random() * 7);
        const day = week * 7 + dayInWeek;
        if (day >= totalDays) continue;

        const durationVariance = rate.duration_variance > 0
          ? Math.floor(Math.random() * (rate.duration_variance * 2 + 1)) - rate.duration_variance
          : 0;
        const duration = Math.max(0, rate.duration_days + durationVariance);

        const parent = rate.requires_parent
          ? (Math.random() < 0.5 ? 'parent_a' : 'parent_b')
          : undefined;

        events.push({
          type: rate.type,
          category: rate.category,
          day,
          duration,
          parent,
          description: rate.description,
        });
      }
    }
  }

  // Sort by day
  events.sort((a, b) => a.day - b.day);
  return events;
}

// ── Disruption Density Stats ──

export function estimateDisruptionsPerYear(childrenAges: number[]): number {
  let total = 0;
  for (const rate of DISRUPTION_RATES) {
    let weeklyProb = rate.weekly_probability;
    if (rate.age_modifier && childrenAges.length > 0) {
      weeklyProb *= Math.max(...childrenAges.map(rate.age_modifier));
    }
    total += weeklyProb * 52;
  }
  return Math.round(total * 10) / 10;
}
