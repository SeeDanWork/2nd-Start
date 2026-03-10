import {
  ScenarioExecutionContext,
  ScenarioFixture,
  ScenarioStep,
  ScenarioStepResult,
  ScenarioSolveBaselineStep,
  ScenarioApplyOverlayStep,
  ScenarioRunRepairStep,
  ScenarioGenerateProposalsStep,
  ScenarioAcceptProposalStep,
  ScenarioRejectProposalStep,
  ScenarioIngestCalendarStep,
  ScenarioAppendFairnessAdjustmentStep,
  ScenarioBuildExplanationStep,
} from '../types';
import { ScenarioNameResolver } from '../core/ScenarioNameResolver';
import { ScenarioExecutionError } from '../errors';

// Domain imports
import { solve } from '../../solver';
import type { SolverInput, SolverConfig, ObjectiveWeights } from '../../solver';
import { evaluatePolicies, createDefaultRegistry } from '../../policy';
import type { TypedPolicyRule, ScheduleSnapshotLike } from '../../policy';
import { CalendarEventIngestionService } from '../../calendar';
import { ExplanationEngine } from '../../explanations';
import type { ChildId, ParentId, FamilyId, ScheduleId } from '../../types';
import { ParentRole } from '../../enums';
import type { Child } from '../../models/Child';
import type { Parent } from '../../models/Parent';

const resolver = new ScenarioNameResolver();

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
  candidateCount: 3,
  primaryMultiplier: 1.0,
  objectiveWeights: DEFAULT_WEIGHTS,
  deterministicSeed: 'scenario-lab',
};

/**
 * Dispatches each step type to the correct domain workflow.
 */
export class ScenarioStepExecutor {
  async executeStep(input: {
    context: ScenarioExecutionContext;
    fixture: ScenarioFixture;
    step: ScenarioStep;
  }): Promise<ScenarioStepResult> {
    const { context, fixture, step } = input;

    try {
      switch (step.type) {
        case 'SOLVE_BASELINE':
          return await this.executeSolveBaseline(context, fixture, step);
        case 'APPLY_OVERLAY':
          return this.executeApplyOverlay(context, step);
        case 'RUN_REPAIR':
          return await this.executeRunRepair(context, fixture, step);
        case 'GENERATE_PROPOSALS':
          return this.executeGenerateProposals(context, step);
        case 'ACCEPT_PROPOSAL':
          return this.executeAcceptProposal(context, step);
        case 'REJECT_PROPOSAL':
          return this.executeRejectProposal(context, step);
        case 'INGEST_CALENDAR':
          return this.executeIngestCalendar(context, fixture, step);
        case 'APPEND_FAIRNESS_ADJUSTMENT':
          return this.executeAppendFairnessAdjustment(context, step);
        case 'BUILD_EXPLANATION':
          return await this.executeBuildExplanation(context, step);
        default:
          throw new ScenarioExecutionError(
            `Unknown step type: ${(step as any).type}`,
          );
      }
    } catch (err) {
      return {
        stepId: step.stepId,
        stepType: step.type,
        status: 'FAILED',
        outputs: {},
        error: {
          code: (err as any).name ?? 'EXECUTION_ERROR',
          message: (err as Error).message,
        },
      };
    }
  }

  private async executeSolveBaseline(
    context: ScenarioExecutionContext,
    fixture: ScenarioFixture,
    step: ScenarioSolveBaselineStep,
  ): Promise<ScenarioStepResult> {
    // Build children with proper branded types
    const children: Child[] = fixture.seed.children.map(c => ({
      id: context.childIdsByName[c.name] as ChildId,
      familyId: context.familyId as FamilyId,
      name: c.name,
      birthDate: c.birthDate,
      createdAt: new Date(),
    }));

    const parents: Parent[] = fixture.seed.parents.map(p => ({
      id: context.parentIdsByName[p.name] as ParentId,
      familyId: context.familyId as FamilyId,
      name: p.name,
      role: (p.role as ParentRole) ?? ParentRole.GUARDIAN,
      email: p.email ?? `${p.name.toLowerCase().replace(/\s/g, '.')}@example.com`,
      createdAt: new Date(),
    }));

    // Build policies from seed
    const activePolicies: TypedPolicyRule[] = (fixture.seed.policies ?? []).map((p, i) => ({
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

    const config: SolverConfig = {
      ...DEFAULT_CONFIG,
      candidateCount: step.candidateCount ?? 3,
    };

    const solverInput: SolverInput = {
      familyId: context.familyId,
      window: { startDate: step.windowStart, endDate: step.windowEnd },
      children,
      parents,
      activePolicies,
      solverConfig: config,
      baselineSchedule: context.activeScheduleNights.length > 0
        ? {
            scheduleVersionId: context.activeScheduleVersionId ?? 'v0',
            familyId: context.familyId,
            startDate: context.activeWindowStart ?? step.windowStart,
            endDate: context.activeWindowEnd ?? step.windowEnd,
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
          }
        : undefined,
      fairnessState: {
        byParentId: Object.fromEntries(
          Object.entries(context.fairnessLedger).map(([pid, data]) => [
            pid,
            { nightDeviation: data.nightDeviation, weekendDeviation: data.weekendDeviation, holidayDeviation: data.holidayDeviation },
          ]),
        ),
      },
    };

    const result = await solve(solverInput);

    // Update context with first/selected candidate
    const selectedId = result.selectedCandidateId ?? result.candidates[0]?.candidateId;
    const selected = result.candidates.find(c => c.candidateId === selectedId) ?? result.candidates[0];

    if (selected) {
      context.activeScheduleNights = selected.nights.map(n => ({
        date: n.date,
        childId: n.childId,
        parentId: n.parentId,
      }));
      context.activeScheduleExchanges = selected.exchanges.map(e => ({
        date: e.date,
        childId: e.childId,
        fromParentId: e.fromParentId,
        toParentId: e.toParentId,
        time: e.time ?? '18:00',
        location: e.location ?? 'default',
      }));
      context.activeWindowStart = step.windowStart;
      context.activeWindowEnd = step.windowEnd;
      // Don't bump version here — solve produces candidates; only accept creates a committed version
      if (!context.activeScheduleVersionId) {
        context.activeScheduleVersionId = `schedule:${context.familyId}:v${context.scheduleVersionNumber}`;
      }

      // Run policy evaluation
      if (activePolicies.length > 0) {
        const snapshot: ScheduleSnapshotLike = {
          familyId: context.familyId,
          startDate: step.windowStart,
          endDate: step.windowEnd,
          nights: context.activeScheduleNights,
          exchanges: context.activeScheduleExchanges,
        };
        const registry = createDefaultRegistry();
        const policyResult = evaluatePolicies(activePolicies, snapshot, {
          familyId: context.familyId,
          scheduleStartDate: step.windowStart,
          scheduleEndDate: step.windowEnd,
        }, registry);

        context.latestPolicyEvaluation = {
          hardViolationCount: policyResult.hardViolations.length,
          strongViolationCount: policyResult.strongViolations.length,
          softViolationCount: policyResult.softViolations.length,
        };
      }
    }

    // Store candidates as proposals
    for (const candidate of result.candidates) {
      context.proposals.push({
        proposalId: candidate.candidateId,
        status: 'PENDING',
        origin: 'BASELINE_SOLVER',
        scheduleNights: candidate.nights.map(n => ({
          date: n.date,
          childId: n.childId,
          parentId: n.parentId,
        })),
      });
    }

    return {
      stepId: step.stepId,
      stepType: 'SOLVE_BASELINE',
      status: 'SUCCESS',
      outputs: {
        candidateCount: result.candidates.length,
        selectedCandidateId: selectedId,
      },
    };
  }

  private executeApplyOverlay(
    context: ScenarioExecutionContext,
    step: ScenarioApplyOverlayStep,
  ): ScenarioStepResult {
    for (const overlay of step.overlays) {
      const childId = resolver.resolveChildId(context, overlay.childName);
      const parentId = resolver.resolveParentId(context, overlay.assignedParentName);

      context.appliedOverlays.push({
        childId,
        date: overlay.date,
        assignedParentId: parentId,
        disruptionType: overlay.disruptionType,
        reason: overlay.reason,
      });

      // Apply overlay to active schedule
      const nightIdx = context.activeScheduleNights.findIndex(
        n => n.date === overlay.date && n.childId === childId,
      );
      if (nightIdx >= 0) {
        context.activeScheduleNights[nightIdx].parentId = parentId;
      } else {
        context.activeScheduleNights.push({
          date: overlay.date,
          childId,
          parentId,
        });
        context.activeScheduleNights.sort((a, b) =>
          a.date.localeCompare(b.date) || a.childId.localeCompare(b.childId),
        );
      }
    }

    return {
      stepId: step.stepId,
      stepType: 'APPLY_OVERLAY',
      status: 'SUCCESS',
      outputs: { overlayCount: step.overlays.length },
    };
  }

  private async executeRunRepair(
    context: ScenarioExecutionContext,
    fixture: ScenarioFixture,
    step: ScenarioRunRepairStep,
  ): Promise<ScenarioStepResult> {
    // Repair uses the same solve pipeline with overlay-adjusted baseline
    // For scenario lab, we re-solve with current state as baseline
    const windowStart = step.repairWindowStart ?? context.activeWindowStart ?? '';
    const windowEnd = step.repairWindowEnd ?? context.activeWindowEnd ?? '';

    const repairChildren: Child[] = fixture.seed.children.map(c => ({
      id: context.childIdsByName[c.name] as ChildId,
      familyId: context.familyId as FamilyId,
      name: c.name,
      birthDate: c.birthDate,
      createdAt: new Date(),
    }));

    const repairParents: Parent[] = fixture.seed.parents.map(p => ({
      id: context.parentIdsByName[p.name] as ParentId,
      familyId: context.familyId as FamilyId,
      name: p.name,
      role: (p.role as ParentRole) ?? ParentRole.GUARDIAN,
      email: p.email ?? `${p.name.toLowerCase().replace(/\s/g, '.')}@example.com`,
      createdAt: new Date(),
    }));

    const activePolicies: TypedPolicyRule[] = (fixture.seed.policies ?? []).map((p, i) => ({
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

    const config: SolverConfig = {
      ...DEFAULT_CONFIG,
      candidateCount: step.candidateCount ?? 3,
    };

    const solverInput: SolverInput = {
      familyId: context.familyId,
      window: { startDate: windowStart, endDate: windowEnd },
      children: repairChildren,
      parents: repairParents,
      activePolicies,
      solverConfig: config,
      baselineSchedule: {
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
      },
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

    // Store repair candidates as proposals
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

    return {
      stepId: step.stepId,
      stepType: 'RUN_REPAIR',
      status: 'SUCCESS',
      outputs: {
        candidateCount: result.candidates.length,
        resolvedOverlays: context.resolvedOverlayCount,
      },
    };
  }

  private executeGenerateProposals(
    context: ScenarioExecutionContext,
    step: ScenarioGenerateProposalsStep,
  ): ScenarioStepResult {
    // Proposals were already generated during solve/repair steps
    const matchingProposals = context.proposals.filter(
      p => p.origin === step.origin && p.status === 'PENDING',
    );

    return {
      stepId: step.stepId,
      stepType: 'GENERATE_PROPOSALS',
      status: 'SUCCESS',
      outputs: {
        proposalCount: matchingProposals.length,
        proposalIds: matchingProposals.map(p => p.proposalId),
      },
    };
  }

  private executeAcceptProposal(
    context: ScenarioExecutionContext,
    step: ScenarioAcceptProposalStep,
  ): ScenarioStepResult {
    const pending = context.proposals.filter(p => p.status === 'PENDING');
    let target;

    if (step.selection.strategy === 'FIRST') {
      target = pending[0];
    } else {
      target = pending.find(p => p.proposalId === step.selection.proposalId);
    }

    if (!target) {
      throw new ScenarioExecutionError(
        `No pending proposal found for acceptance in step ${step.stepId}`,
      );
    }

    // Accept
    target.status = 'ACCEPTED';

    // Apply accepted schedule
    if (target.scheduleNights) {
      context.activeScheduleNights = [...target.scheduleNights];
      context.activeScheduleNights.sort((a, b) =>
        a.date.localeCompare(b.date) || a.childId.localeCompare(b.childId),
      );
    }

    // Invalidate sibling proposals
    for (const p of context.proposals) {
      if (p.proposalId !== target.proposalId && p.status === 'PENDING') {
        p.status = 'INVALIDATED';
      }
    }

    // Bump version
    context.scheduleVersionNumber++;
    context.activeScheduleVersionId = `schedule:${context.familyId}:v${context.scheduleVersionNumber}`;

    return {
      stepId: step.stepId,
      stepType: 'ACCEPT_PROPOSAL',
      status: 'SUCCESS',
      outputs: {
        acceptedProposalId: target.proposalId,
        newVersionNumber: context.scheduleVersionNumber,
        invalidatedCount: context.proposals.filter(p => p.status === 'INVALIDATED').length,
      },
    };
  }

  private executeRejectProposal(
    context: ScenarioExecutionContext,
    step: ScenarioRejectProposalStep,
  ): ScenarioStepResult {
    const pending = context.proposals.filter(p => p.status === 'PENDING');
    let target;

    if (step.selection.strategy === 'FIRST') {
      target = pending[0];
    } else {
      target = pending.find(p => p.proposalId === step.selection.proposalId);
    }

    if (!target) {
      throw new ScenarioExecutionError(
        `No pending proposal found for rejection in step ${step.stepId}`,
      );
    }

    target.status = 'REJECTED';

    return {
      stepId: step.stepId,
      stepType: 'REJECT_PROPOSAL',
      status: 'SUCCESS',
      outputs: { rejectedProposalId: target.proposalId },
    };
  }

  private executeIngestCalendar(
    context: ScenarioExecutionContext,
    fixture: ScenarioFixture,
    step: ScenarioIngestCalendarStep,
  ): ScenarioStepResult {
    const ingestionService = new CalendarEventIngestionService();

    const externalEvents = step.events.map((evt, i) => ({
      externalId: `cal:${step.stepId}:${i}`,
      source: evt.source ?? 'google',
      title: evt.title,
      description: evt.description,
      startTime: evt.startTime,
      endTime: evt.endTime,
      allDay: evt.allDay ?? false,
      metadata: {} as Record<string, unknown>,
    }));

    // Build family context for ingestion
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

    // Record classified events
    for (const evt of result.events) {
      context.calendarEvents.push({
        title: evt.title,
        kind: evt.kind,
        constraintLevel: evt.constraintLevel,
        date: evt.startTime.split('T')[0],
      });
    }

    return {
      stepId: step.stepId,
      stepType: 'INGEST_CALENDAR',
      status: 'SUCCESS',
      outputs: {
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        eventCount: result.events.length,
      },
    };
  }

  private executeAppendFairnessAdjustment(
    context: ScenarioExecutionContext,
    step: ScenarioAppendFairnessAdjustmentStep,
  ): ScenarioStepResult {
    for (const delta of step.deltas) {
      const parentId = resolver.resolveParentId(context, delta.parentName);
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

    return {
      stepId: step.stepId,
      stepType: 'APPEND_FAIRNESS_ADJUSTMENT',
      status: 'SUCCESS',
      outputs: { adjustedParentCount: step.deltas.length },
    };
  }

  private async executeBuildExplanation(
    context: ScenarioExecutionContext,
    step: ScenarioBuildExplanationStep,
  ): Promise<ScenarioStepResult> {
    const engine = new ExplanationEngine();

    let targetId: string;
    if (step.targetSelector.strategy === 'BY_ID') {
      targetId = step.targetSelector.targetId!;
    } else {
      // LATEST — pick based on target type
      switch (step.targetType) {
        case 'SCHEDULE_VERSION':
          targetId = context.activeScheduleVersionId ?? 'unknown';
          break;
        case 'PROPOSAL': {
          const accepted = context.proposals.find(p => p.status === 'ACCEPTED');
          targetId = accepted?.proposalId ?? context.proposals[0]?.proposalId ?? 'unknown';
          break;
        }
        case 'PROPOSAL_ACCEPTANCE':
          targetId = context.activeScheduleVersionId ?? 'unknown';
          break;
        case 'CALENDAR_EVENT_CLASSIFICATION':
          targetId = `calendar:${context.familyId}`;
          break;
        default:
          targetId = 'unknown';
      }
    }

    // Build raw artifacts from context
    const rawArtifacts: Array<{ type: string; data: Record<string, unknown>; sourceType: string }> = [];

    // Add calendar artifacts
    for (const evt of context.calendarEvents) {
      rawArtifacts.push({
        type: 'CALENDAR_CLASSIFICATION',
        data: { kind: evt.kind, constraintLevel: evt.constraintLevel, date: evt.date, title: evt.title },
        sourceType: 'CALENDAR',
      });
    }

    // Add acceptance artifacts
    if (step.targetType === 'PROPOSAL_ACCEPTANCE') {
      const accepted = context.proposals.find(p => p.status === 'ACCEPTED');
      if (accepted) {
        rawArtifacts.push({
          type: 'ACCEPTANCE_RESULT',
          data: { proposalId: accepted.proposalId, newVersionNumber: context.scheduleVersionNumber },
          sourceType: 'ACCEPTANCE',
        });
      }
      const invalidated = context.proposals.filter(p => p.status === 'INVALIDATED');
      if (invalidated.length > 0) {
        rawArtifacts.push({
          type: 'INVALIDATED_PROPOSALS',
          data: { invalidatedIds: invalidated.map(p => p.proposalId) },
          sourceType: 'ACCEPTANCE',
        });
      }
    }

    const bundle = await engine.buildBundle({
      targetType: step.targetType,
      targetId,
      rawArtifacts,
      createdAt: new Date().toISOString(),
      persist: step.persist,
    });

    const allRecords = [
      ...bundle.changeExplanations,
      ...bundle.fairnessExplanations,
      ...bundle.policyExplanations,
      ...bundle.calendarExplanations,
      ...bundle.acceptanceExplanations,
    ];

    context.explanationBundles.push({
      targetType: step.targetType,
      targetId,
      recordCount: allRecords.length,
      codes: allRecords.map(r => r.code),
    });

    return {
      stepId: step.stepId,
      stepType: 'BUILD_EXPLANATION',
      status: 'SUCCESS',
      outputs: {
        targetId,
        recordCount: allRecords.length,
        codes: allRecords.map(r => r.code),
      },
    };
  }
}
