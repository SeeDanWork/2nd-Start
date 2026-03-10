import { ScenarioFixture, SeededScenarioContext, ScenarioExecutionContext } from '../types';
import { ScenarioSeedError } from '../errors';

/**
 * Seeds a clean scenario state from a fixture definition.
 * Uses deterministic ID generation based on seed names.
 */
export class ScenarioSeeder {
  seedScenario(fixture: ScenarioFixture): ScenarioExecutionContext {
    const { seed } = fixture;

    // Deterministic ID generation from names
    const familyId = seed.family.id ?? `family:${seed.family.name}`;

    const parentIdsByName: Record<string, string> = {};
    for (const parent of seed.parents.sort((a, b) => a.name.localeCompare(b.name))) {
      parentIdsByName[parent.name] = parent.id ?? `parent:${parent.name}`;
    }

    const childIdsByName: Record<string, string> = {};
    for (const child of (seed.children ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
      childIdsByName[child.name] = child.id ?? `child:${child.name}`;
    }

    // Build initial schedule if provided
    let activeScheduleNights: ScenarioExecutionContext['activeScheduleNights'] = [];
    let activeScheduleExchanges: ScenarioExecutionContext['activeScheduleExchanges'] = [];
    let activeScheduleVersionId: string | undefined;
    let activeWindowStart: string | undefined;
    let activeWindowEnd: string | undefined;

    if (seed.initialSchedule) {
      activeWindowStart = seed.initialSchedule.windowStart;
      activeWindowEnd = seed.initialSchedule.windowEnd;
      activeScheduleVersionId = `schedule:${familyId}:v1`;

      for (const night of seed.initialSchedule.nights) {
        const childId = childIdsByName[night.childName];
        const parentId = parentIdsByName[night.parentName];
        if (!childId) throw new ScenarioSeedError(`Unknown child in initial schedule: ${night.childName}`);
        if (!parentId) throw new ScenarioSeedError(`Unknown parent in initial schedule: ${night.parentName}`);
        activeScheduleNights.push({ date: night.date, childId, parentId });
      }

      // Sort deterministically
      activeScheduleNights.sort((a, b) =>
        a.date.localeCompare(b.date) || a.childId.localeCompare(b.childId),
      );

      if (seed.initialSchedule.exchanges) {
        for (const ex of seed.initialSchedule.exchanges) {
          const childId = childIdsByName[ex.childName];
          const fromParentId = parentIdsByName[ex.fromParentName];
          const toParentId = parentIdsByName[ex.toParentName];
          if (!childId || !fromParentId || !toParentId) {
            throw new ScenarioSeedError(`Unknown name in initial exchange`);
          }
          activeScheduleExchanges.push({
            date: ex.date,
            childId,
            fromParentId,
            toParentId,
            time: ex.time ?? '18:00',
            location: ex.location ?? 'default',
          });
        }
        activeScheduleExchanges.sort((a, b) =>
          a.date.localeCompare(b.date) || a.childId.localeCompare(b.childId),
        );
      }
    }

    // Build fairness ledger
    const fairnessLedger: ScenarioExecutionContext['fairnessLedger'] = {};
    if (seed.fairnessLedger) {
      for (const entry of seed.fairnessLedger) {
        const parentId = parentIdsByName[entry.parentName];
        if (!parentId) throw new ScenarioSeedError(`Unknown parent in fairness ledger: ${entry.parentName}`);
        fairnessLedger[parentId] = {
          nightDeviation: entry.nightDeviation,
          weekendDeviation: entry.weekendDeviation,
          holidayDeviation: entry.holidayDeviation,
        };
      }
    } else {
      // Initialize zero-state for all parents
      for (const parentId of Object.values(parentIdsByName)) {
        fairnessLedger[parentId] = { nightDeviation: 0, weekendDeviation: 0, holidayDeviation: 0 };
      }
    }

    // Calendar events will be ingested via steps, but seed initial if provided
    const calendarEvents: ScenarioExecutionContext['calendarEvents'] = [];
    if (seed.calendarEvents) {
      for (const evt of seed.calendarEvents) {
        calendarEvents.push({
          title: evt.title,
          kind: evt.kind ?? 'OTHER',
          constraintLevel: evt.constraintLevel ?? 'SOFT',
          date: evt.startTime.split('T')[0],
        });
      }
    }

    return {
      familyId,
      parentIdsByName,
      childIdsByName,
      activeScheduleVersionId,
      activeScheduleNights,
      activeScheduleExchanges,
      activeWindowStart,
      activeWindowEnd,
      appliedOverlays: [],
      proposals: [],
      fairnessLedger,
      calendarEvents,
      explanationBundles: [],
      resolvedOverlayCount: 0,
      scheduleVersionNumber: seed.initialSchedule ? 1 : 0,
    };
  }
}
