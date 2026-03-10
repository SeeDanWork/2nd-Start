import {
  SimulationFixture,
  SimulationExecutionContext,
  SimulationGeneratedEvent,
  SimulationOverlayEvent,
  SimulationSwapIntentEvent,
  SimulationCalendarImportEvent,
  SimulationFairnessAdjustmentEvent,
  SimulationStepResult,
  SimulationStep,
} from '../types';
import { SimulationExecutionError } from '../errors';

// Domain imports — same pattern as ScenarioStepExecutor
import { solve } from '../../solver';
import type { SolverInput, SolverConfig, ObjectiveWeights } from '../../solver';
import { CalendarEventIngestionService } from '../../calendar';
import type { ChildId, ParentId, FamilyId, ScheduleId } from '../../types';
import { ParentRole } from '../../enums';
import type { Child } from '../../models/Child';
import type { Parent } from '../../models/Parent';
import type { TypedPolicyRule } from '../../policy';

const DEFAULT_WEIGHTS: ObjectiveWeights = {
  stability: 0.3,
  familyStructure: 0.1,
  fairness: 0.25,
  parentPreference: 0.05,
  childPreference: 0.05,
  logistics: 0.1,
  convenience: 0.05,
  nightsFairness: 0.4,
  weekendsFairness: 0.35,
  holidaysFairness: 0.25,
};

const DEFAULT_CONFIG: SolverConfig = {
  candidateCount: 2,
  primaryMultiplier: 1.0,
  objectiveWeights: DEFAULT_WEIGHTS,
  deterministicSeed: 'simulation',
};

/**
 * Executes simulation-generated events against real domain workflows.
 */
export class SimulationStepExecutor {
  async executeStep(input: {
    step: SimulationStep;
    generatedEvents: SimulationGeneratedEvent[];
    fixture: SimulationFixture;
    context: SimulationExecutionContext;
  }): Promise<SimulationStepResult> {
    const { step, generatedEvents: events, context, fixture } = input;
    const { stepIndex, date } = step;

    try {
      const outputs: Record<string, unknown> = {};

      for (const event of events) {
        switch (event.type) {
          case 'OVERLAY':
            this.applyOverlay(context, event);
            outputs.overlayApplied = true;
            break;
          case 'SWAP_INTENT':
            await this.handleSwapIntent(context, fixture, event, date);
            outputs.swapProcessed = true;
            break;
          case 'CALENDAR_IMPORT':
            this.ingestCalendar(context, event);
            outputs.calendarIngested = true;
            break;
          case 'FAIRNESS_ADJUSTMENT':
            this.applyFairnessAdjustment(context, event);
            outputs.fairnessAdjusted = true;
            break;
        }
      }

      // If overlays were applied and repair is enabled, run repair
      if (outputs.overlayApplied && fixture.config.enableRepairOnOverlay) {
        await this.runRepair(context, fixture, date);
        outputs.repairRan = true;
      }

      // Auto-accept strategy
      if (fixture.config.autoAcceptStrategy && fixture.config.autoAcceptStrategy !== 'NONE') {
        this.autoAccept(context, fixture.config.autoAcceptStrategy);
      }

      return {
        stepIndex,
        date,
        generatedEvents: events,
        outputs,
        status: 'SUCCESS',
      };
    } catch (err) {
      return {
        stepIndex,
        date,
        generatedEvents: events,
        outputs: {},
        status: 'FAILED',
        error: {
          code: (err as any).name ?? 'SIMULATION_STEP_ERROR',
          message: (err as Error).message,
        },
      };
    }
  }

  private applyOverlay(context: SimulationExecutionContext, event: SimulationOverlayEvent): void {
    const childId = this.resolveChildId(context, event.childName);
    const parentId = this.resolveParentId(context, event.assignedParentName);

    context.appliedOverlays.push({
      childId,
      date: event.date,
      assignedParentId: parentId,
      disruptionType: event.disruptionType,
      reason: event.reason,
    });

    // Apply to active schedule
    const nightIdx = context.activeScheduleNights.findIndex(
      n => n.date === event.date && n.childId === childId,
    );
    if (nightIdx >= 0) {
      context.activeScheduleNights[nightIdx].parentId = parentId;
    }
  }

  private async handleSwapIntent(
    context: SimulationExecutionContext,
    fixture: SimulationFixture,
    event: SimulationSwapIntentEvent,
    date: string,
  ): Promise<void> {
    if (!fixture.config.enableProposalGeneration) return;

    // Generate a proposal via solver
    const seed = fixture.seedScenario.seed;
    const children = this.buildChildren(context, seed);
    const parents = this.buildParents(context, seed);
    const policies = this.buildPolicies(context, seed);

    const windowStart = date;
    const windowEnd = context.activeWindowEnd ?? date;

    const solverInput: SolverInput = {
      familyId: context.familyId,
      window: { startDate: windowStart, endDate: windowEnd },
      children,
      parents,
      activePolicies: policies,
      solverConfig: { ...DEFAULT_CONFIG, deterministicSeed: `sim:swap:${date}` },
      baselineSchedule: this.buildBaselineSchedule(context, windowStart, windowEnd),
      fairnessState: {
        byParentId: Object.fromEntries(
          Object.entries(context.fairnessLedger).map(([pid, data]) => [pid, { ...data }]),
        ),
      },
    };

    const result = await solve(solverInput);

    for (const candidate of result.candidates) {
      context.proposals.push({
        proposalId: candidate.candidateId,
        status: 'PENDING',
        origin: 'SWAP_REQUEST',
        scheduleNights: candidate.nights.map(n => ({
          date: n.date,
          childId: n.childId,
          parentId: n.parentId,
        })),
      });
    }
  }

  private ingestCalendar(context: SimulationExecutionContext, event: SimulationCalendarImportEvent): void {
    const ingestionService = new CalendarEventIngestionService();

    const externalEvents = event.events.map((evt, i) => ({
      externalId: `sim-cal:${event.date}:${i}`,
      source: evt.source ?? 'google',
      title: evt.title,
      description: evt.description,
      startTime: evt.startTime,
      endTime: evt.endTime,
      allDay: evt.allDay ?? false,
      metadata: {} as Record<string, unknown>,
    }));

    const familyContext = {
      familyId: context.familyId,
      parents: Object.entries(context.parentIdsByName).map(([name, id]) => ({ id, name })),
      children: Object.entries(context.childIdsByName).map(([name, id]) => ({ id, name })),
    };

    const result = ingestionService.ingestEvents({
      familyId: context.familyId,
      events: externalEvents,
      familyContext,
    });

    for (const evt of result.events) {
      context.calendarEvents.push({
        title: evt.title,
        kind: evt.kind,
        constraintLevel: evt.constraintLevel,
        date: evt.startTime.split('T')[0],
      });
    }
  }

  private applyFairnessAdjustment(context: SimulationExecutionContext, event: SimulationFairnessAdjustmentEvent): void {
    for (const delta of event.deltas) {
      const parentId = this.resolveParentId(context, delta.parentName);
      const current = context.fairnessLedger[parentId] ?? {
        nightDeviation: 0,
        weekendDeviation: 0,
        holidayDeviation: 0,
      };
      context.fairnessLedger[parentId] = {
        nightDeviation: current.nightDeviation + delta.nightDelta,
        weekendDeviation: current.weekendDeviation + delta.weekendDelta,
        holidayDeviation: current.holidayDeviation + delta.holidayDelta,
      };
    }
  }

  private async runRepair(
    context: SimulationExecutionContext,
    fixture: SimulationFixture,
    date: string,
  ): Promise<void> {
    const seed = fixture.seedScenario.seed;
    const children = this.buildChildren(context, seed);
    const parents = this.buildParents(context, seed);
    const policies = this.buildPolicies(context, seed);

    const windowStart = context.activeWindowStart ?? date;
    const windowEnd = context.activeWindowEnd ?? date;

    const solverInput: SolverInput = {
      familyId: context.familyId,
      window: { startDate: windowStart, endDate: windowEnd },
      children,
      parents,
      activePolicies: policies,
      solverConfig: { ...DEFAULT_CONFIG, deterministicSeed: `sim:repair:${date}` },
      baselineSchedule: this.buildBaselineSchedule(context, windowStart, windowEnd),
      fairnessState: {
        byParentId: Object.fromEntries(
          Object.entries(context.fairnessLedger).map(([pid, data]) => [pid, { ...data }]),
        ),
      },
    };

    const result = await solve(solverInput);

    // Resolve overlays
    context.resolvedOverlayCount += context.appliedOverlays.length;
    context.appliedOverlays = [];

    // Store repair candidates
    for (const candidate of result.candidates) {
      context.proposals.push({
        proposalId: candidate.candidateId,
        status: 'PENDING',
        origin: 'REPAIR_SOLVER',
        scheduleNights: candidate.nights.map(n => ({
          date: n.date,
          childId: n.childId,
          parentId: n.parentId,
        })),
      });
    }
  }

  private autoAccept(context: SimulationExecutionContext, strategy: 'FIRST' | 'BEST_SCORE'): void {
    const pending = context.proposals.filter(p => p.status === 'PENDING');
    if (pending.length === 0) return;

    // Both strategies pick the first for now (scoring would require solver scores)
    const target = pending[0];
    target.status = 'ACCEPTED';

    if (target.scheduleNights) {
      // Track previous schedule for churn calculation
      context.previousScheduleNights = [...context.activeScheduleNights];
      context.activeScheduleNights = [...target.scheduleNights];
      context.activeScheduleNights.sort((a, b) =>
        a.date.localeCompare(b.date) || a.childId.localeCompare(b.childId),
      );
    }

    // Invalidate other pending proposals
    for (const p of context.proposals) {
      if (p.proposalId !== target.proposalId && p.status === 'PENDING') {
        p.status = 'INVALIDATED';
      }
    }

    context.scheduleVersionNumber++;
    context.activeScheduleVersionId = `schedule:${context.familyId}:v${context.scheduleVersionNumber}`;
  }

  // ── Helpers ──

  private resolveChildId(context: SimulationExecutionContext, name: string): string {
    const id = context.childIdsByName[name];
    if (!id) throw new SimulationExecutionError(`Unknown child: ${name}`);
    return id;
  }

  private resolveParentId(context: SimulationExecutionContext, name: string): string {
    const id = context.parentIdsByName[name];
    if (!id) throw new SimulationExecutionError(`Unknown parent: ${name}`);
    return id;
  }

  private buildChildren(context: SimulationExecutionContext, seed: any): Child[] {
    return (seed.children ?? []).map((c: any) => ({
      id: context.childIdsByName[c.name] as ChildId,
      familyId: context.familyId as FamilyId,
      name: c.name,
      birthDate: c.birthDate,
      createdAt: new Date(),
    }));
  }

  private buildParents(context: SimulationExecutionContext, seed: any): Parent[] {
    return (seed.parents ?? []).map((p: any) => ({
      id: context.parentIdsByName[p.name] as ParentId,
      familyId: context.familyId as FamilyId,
      name: p.name,
      role: (p.role as ParentRole) ?? ParentRole.GUARDIAN,
      email: p.email ?? `${p.name.toLowerCase().replace(/\s/g, '.')}@example.com`,
      createdAt: new Date(),
    }));
  }

  private buildPolicies(context: SimulationExecutionContext, seed: any): TypedPolicyRule[] {
    return (seed.policies ?? []).map((p: any, i: number) => ({
      id: `policy:${i}`,
      familyId: context.familyId,
      ruleType: p.ruleType as any,
      priority: p.priority as any,
      parameters: p.parameters as any,
      scope: p.scope ?? { scopeType: 'FAMILY' } as any,
      active: true,
      label: p.label ?? `Policy ${i}`,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
  }

  private buildBaselineSchedule(context: SimulationExecutionContext, windowStart: string, windowEnd: string) {
    if (context.activeScheduleNights.length === 0) return undefined;
    return {
      scheduleVersionId: context.activeScheduleVersionId ?? 'v0',
      familyId: context.familyId,
      startDate: windowStart,
      endDate: windowEnd,
      nights: context.activeScheduleNights.map((n, i) => ({
        id: `night:${i}`,
        scheduleId: (context.activeScheduleVersionId ?? 'v0') as ScheduleId,
        date: n.date,
        childId: n.childId as ChildId,
        parentId: n.parentId as ParentId,
        createdAt: new Date(),
      })),
      exchanges: context.activeScheduleExchanges.map((e, i) => ({
        id: `exchange:${i}`,
        scheduleId: (context.activeScheduleVersionId ?? 'v0') as ScheduleId,
        date: e.date,
        childId: e.childId as ChildId,
        fromParentId: e.fromParentId as ParentId,
        toParentId: e.toParentId as ParentId,
        time: e.time,
        location: e.location,
        createdAt: new Date(),
      })),
    };
  }
}
