import { ScenarioConfig, ScheduleDay } from './types';

// Template rotation patterns (days assigned to parent_a per cycle)
// true = parent_a, false = parent_b
const TEMPLATE_PATTERNS: Record<string, boolean[]> = {
  // Alternating weeks: 7 days A, 7 days B
  'alternating_weeks': [
    true, true, true, true, true, true, true,
    false, false, false, false, false, false, false,
  ],
  // 2-2-3: Mon-Tue A, Wed-Thu B, Fri-Sun A, then flip
  '2-2-3': [
    true, true, false, false, true, true, true,
    false, false, true, true, false, false, false,
  ],
  // 3-4-4-3: 3 days A, 4 days B, 4 days A, 3 days B
  '3-4-4-3': [
    true, true, true, false, false, false, false,
    true, true, true, true, false, false, false,
  ],
  // 5-2: 5 days A, 2 days B (every week)
  '5-2': [
    true, true, true, true, true, false, false,
  ],
  // Every other weekend: weekdays A, alternating weekends
  'every_other_weekend': [
    true, true, true, true, true, true, true,
    true, true, true, true, true, false, false,
  ],
};

/**
 * Generate a deterministic schedule based on the scenario config.
 * Produces `weeks` weeks of daily assignments starting from the next Monday.
 */
export function generateSchedule(config: ScenarioConfig, weeks?: number): ScheduleDay[] {
  const numWeeks = weeks || config.simulationWeeks || 8;
  const totalDays = numWeeks * 7;
  const pattern = TEMPLATE_PATTERNS[config.template] || TEMPLATE_PATTERNS['alternating_weeks'];
  const cycleLength = pattern.length;

  // Start from next Monday
  const start = new Date();
  start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7));
  start.setHours(0, 0, 0, 0);

  // Apply locked nights overrides
  const lockedA = new Set<number>(); // day-of-week numbers locked to parent_a
  const lockedB = new Set<number>(); // day-of-week numbers locked to parent_b
  for (const ln of config.lockedNights) {
    for (const dow of ln.daysOfWeek) {
      if (ln.parent === 'parent_a') lockedA.add(dow);
      else lockedB.add(dow);
    }
  }

  const schedule: ScheduleDay[] = [];
  let prevAssigned: 'parent_a' | 'parent_b' | null = null;

  for (let i = 0; i < totalDays; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dow = date.getDay(); // 0=Sun, 6=Sat

    let assignedTo: 'parent_a' | 'parent_b';

    // Locked nights take priority
    if (lockedA.has(dow)) {
      assignedTo = 'parent_a';
    } else if (lockedB.has(dow)) {
      assignedTo = 'parent_b';
    } else {
      // Follow template pattern
      assignedTo = pattern[i % cycleLength] ? 'parent_a' : 'parent_b';
    }

    const isTransition = prevAssigned !== null && prevAssigned !== assignedTo;
    prevAssigned = assignedTo;

    schedule.push({
      date: date.toISOString().split('T')[0],
      assignedTo,
      isTransition,
    });
  }

  return schedule;
}
