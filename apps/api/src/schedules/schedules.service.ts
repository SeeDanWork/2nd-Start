import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import {
  BaseScheduleVersion,
  OvernightAssignment,
  HandoffEvent,
  HolidayCalendar,
  AuditLog,
  ConstraintSet,
  Constraint,
} from '../entities';
import {
  AuditAction,
  AuditEntityType,
  ScheduleSource,
  AssignmentSource,
  HandoffType,
  ParentRole,
  ConstraintType,
  SOLVER_TIMEOUT_SECONDS,
  SOLVER_MAX_SOLUTIONS,
  DEFAULT_MAX_TRANSITIONS_PER_WEEK,
  DEFAULT_SCHEDULE_HORIZON_WEEKS,
  generateIcsString,
} from '@adcp/shared';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FamilyContextService } from '../family-context/family-context.service';
import { DisruptionsService } from '../disruptions/disruptions.service';
import { GoogleCalendarSyncService } from '../google-calendar/google-calendar-sync.service';

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    @InjectRepository(BaseScheduleVersion)
    private readonly versionRepo: Repository<BaseScheduleVersion>,
    @InjectRepository(OvernightAssignment)
    private readonly assignmentRepo: Repository<OvernightAssignment>,
    @InjectRepository(HandoffEvent)
    private readonly handoffRepo: Repository<HandoffEvent>,
    @InjectRepository(HolidayCalendar)
    private readonly holidayRepo: Repository<HolidayCalendar>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(ConstraintSet)
    private readonly constraintSetRepo: Repository<ConstraintSet>,
    @InjectRepository(Constraint)
    private readonly constraintRepo: Repository<Constraint>,
    private readonly httpService: HttpService,
    private readonly familyContextService: FamilyContextService,
    private readonly disruptionsService: DisruptionsService,
    private readonly googleCalendarSyncService: GoogleCalendarSyncService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getActiveSchedule(familyId: string): Promise<BaseScheduleVersion | null> {
    return this.versionRepo.findOne({
      where: { familyId, isActive: true },
    });
  }

  async getScheduleVersion(familyId: string, version: number): Promise<BaseScheduleVersion> {
    const schedule = await this.versionRepo.findOne({
      where: { familyId, version },
    });
    if (!schedule) throw new NotFoundException('Schedule version not found');
    return schedule;
  }

  async getAssignments(
    familyId: string,
    versionId: string,
    startDate: string,
    endDate: string,
  ): Promise<OvernightAssignment[]> {
    return this.assignmentRepo.find({
      where: {
        familyId,
        scheduleVersionId: versionId,
        date: Between(startDate, endDate),
      },
      order: { date: 'ASC' },
    });
  }

  async getHandoffs(
    familyId: string,
    versionId: string,
    startDate: string,
    endDate: string,
  ): Promise<HandoffEvent[]> {
    return this.handoffRepo.find({
      where: {
        familyId,
        scheduleVersionId: versionId,
        date: Between(startDate, endDate),
      },
      order: { date: 'ASC' },
    });
  }

  async getCalendar(familyId: string, startDate: string, endDate: string) {
    const active = await this.getActiveSchedule(familyId);
    if (!active) {
      return { days: [], scheduleVersion: 0 };
    }

    const [assignments, handoffs, holidays] = await Promise.all([
      this.getAssignments(familyId, active.id, startDate, endDate),
      this.getHandoffs(familyId, active.id, startDate, endDate),
      this.getHolidayEntries(familyId, startDate, endDate),
    ]);

    const dayMap = new Map<string, {
      date: string;
      assignment: OvernightAssignment | null;
      handoffs: HandoffEvent[];
      holidayLabel: string | null;
      daycareClosed: boolean;
    }>();

    for (const a of assignments) {
      dayMap.set(a.date, {
        date: a.date,
        assignment: a,
        handoffs: [],
        holidayLabel: null,
        daycareClosed: false,
      });
    }

    for (const h of handoffs) {
      const day = dayMap.get(h.date);
      if (day) {
        day.handoffs.push(h);
      }
    }

    for (const hol of holidays) {
      const day = dayMap.get(hol.date);
      if (day) {
        day.holidayLabel = hol.label;
        day.daycareClosed = hol.daycareClosed;
      }
    }

    return {
      days: Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      scheduleVersion: active.version,
    };
  }

  async exportIcs(
    familyId: string,
    version: number,
    startDate?: string,
    endDate?: string,
  ): Promise<string> {
    const schedule = await this.getScheduleVersion(familyId, version);

    const whereClause: Record<string, any> = {
      familyId,
      scheduleVersionId: schedule.id,
    };
    if (startDate && endDate) {
      whereClause.date = Between(startDate, endDate);
    }

    const assignments = await this.assignmentRepo.find({
      where: whereClause,
      order: { date: 'ASC' },
    });

    const days = assignments.map((a) => ({
      date: a.date,
      assignedTo: a.assignedTo as 'parent_a' | 'parent_b',
    }));

    return generateIcsString(days, {
      uidPrefix: `${familyId}-v${version}`,
    });
  }

  async generateBaseSchedule(
    familyId: string,
    userId: string,
    options?: {
      horizonStart?: string;
      horizonEnd?: string;
      weekendDefinition?: string;
      daycareExchangeDays?: number[];
    },
  ): Promise<BaseScheduleVersion> {
    // 1. Get active constraint set with constraints
    const constraintSet = await this.constraintSetRepo.findOne({
      where: { familyId, isActive: true },
      relations: ['constraints'],
    });
    if (!constraintSet) {
      throw new BadRequestException('No active constraint set found. Add constraints first.');
    }

    // 2. Compute horizon
    const today = new Date();
    const horizonStart = options?.horizonStart || today.toISOString().split('T')[0];
    const horizonWeeks = DEFAULT_SCHEDULE_HORIZON_WEEKS;
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + horizonWeeks * 7);
    const horizonEnd = options?.horizonEnd || endDate.toISOString().split('T')[0];

    const weekendDef = options?.weekendDefinition || 'fri_sat';
    const daycareExchangeDays = options?.daycareExchangeDays || [1, 2, 3, 4, 5]; // Mon-Fri in JS convention

    // 3. Get age-aware family context
    const familyCtx = await this.familyContextService.getContext(familyId);
    const adjustedWeights = this.familyContextService.getAdjustedWeights(familyCtx);

    // 4. Transform constraints into solver format
    const lockedNights: Array<{ parent: string; days_of_week: number[] }> = [];
    const maxConsecutive: Array<{ parent: string; max_nights: number }> = [];
    const bonusWeeks: Array<{ parent: string; start_date: string; end_date: string }> = [];
    let weekendSplit: { target_pct_parent_a: number; tolerance_pct: number } | null = null;
    let maxTransitionsPerWeek = DEFAULT_MAX_TRANSITIONS_PER_WEEK;
    let hasMaxConsecutiveConstraint = false;

    // Collect holiday entries
    const holidays = await this.getHolidayEntries(familyId, horizonStart, horizonEnd);

    for (const c of constraintSet.constraints) {
      const params = c.parameters as Record<string, any>;
      switch (c.type) {
        case ConstraintType.LOCKED_NIGHT:
          lockedNights.push({
            parent: params.parent,
            days_of_week: params.daysOfWeek,
          });
          break;
        case ConstraintType.MAX_CONSECUTIVE:
          hasMaxConsecutiveConstraint = true;
          maxConsecutive.push({
            parent: params.parent,
            max_nights: params.maxNights,
          });
          break;
        case ConstraintType.WEEKEND_SPLIT:
          weekendSplit = {
            target_pct_parent_a: params.targetPctParentA || 50,
            tolerance_pct: params.tolerancePct || 10,
          };
          break;
        case ConstraintType.MAX_TRANSITIONS_PER_WEEK:
          maxTransitionsPerWeek = params.maxTransitions || DEFAULT_MAX_TRANSITIONS_PER_WEEK;
          break;
      }
    }

    // Inject age-aware maxConsecutive default if no explicit constraint exists
    if (!hasMaxConsecutiveConstraint) {
      maxConsecutive.push(
        { parent: 'parent_a', max_nights: familyCtx.maxConsecutive },
        { parent: 'parent_b', max_nights: familyCtx.maxConsecutive },
      );
    }

    // 5. Compute disruption overlay
    const disruptionOverlay = await this.disruptionsService.computeAllOverlays(familyId, []);

    // Apply disruption weight adjustments on top of age+arrangement weights
    const finalWeights = { ...adjustedWeights };
    for (const [key, multiplier] of Object.entries(disruptionOverlay.weight_adjustments)) {
      const camelKey = key as keyof typeof finalWeights;
      if (camelKey in finalWeights) {
        finalWeights[camelKey] = Math.round(finalWeights[camelKey] * multiplier);
      }
    }

    // 6. Build solver request payload (age-adjusted + disruption-adjusted weights)
    const solverPayload = {
      horizon_start: horizonStart,
      horizon_end: horizonEnd,
      locked_nights: lockedNights,
      max_consecutive: maxConsecutive,
      bonus_weeks: bonusWeeks,
      weekend_definition: weekendDef,
      weekend_split: weekendSplit,
      weekend_split_window_weeks: 4,
      max_transitions_per_week: maxTransitionsPerWeek,
      daycare_exchange_days: daycareExchangeDays,
      holidays: holidays.map((h) => ({
        date: h.date,
        label: h.label,
        daycare_closed: h.daycareClosed,
      })),
      weights: {
        fairness_deviation: finalWeights.fairnessDeviation,
        total_transitions: finalWeights.totalTransitions,
        non_daycare_handoffs: finalWeights.nonDaycareHandoffs,
        weekend_fragmentation: finalWeights.weekendFragmentation,
        school_night_disruption: finalWeights.schoolNightDisruption,
      },
      timeout_seconds: SOLVER_TIMEOUT_SECONDS,
      max_solutions: SOLVER_MAX_SOLUTIONS,
      disruption_locks: disruptionOverlay.disruption_locks.map((dl) => ({
        parent: dl.parent,
        date: dl.date,
        source: dl.source,
      })),
    };

    // 5. Call optimizer service
    this.logger.log(`Calling optimizer for family ${familyId}`);
    let solverResponse: any;
    try {
      const response = await firstValueFrom(
        this.httpService.post('/solve/base-schedule', solverPayload),
      );
      solverResponse = response.data;
    } catch (err: any) {
      this.logger.error(`Optimizer call failed: ${err.message}`);
      throw new BadRequestException(
        `Schedule generation failed: ${err.response?.data?.detail || err.message}`,
      );
    }

    // 6. Handle infeasible result
    if (solverResponse.status === 'infeasible') {
      throw new BadRequestException({
        message: 'No feasible schedule exists with current constraints',
        conflicts: solverResponse.conflicting_constraints || [],
        suggestion: 'Try relaxing locked nights or increasing max consecutive nights',
      });
    }

    if (!solverResponse.solutions || solverResponse.solutions.length === 0) {
      throw new BadRequestException('Solver returned no solutions');
    }

    // 7. Use the top-ranked solution
    const bestSolution = solverResponse.solutions[0];

    // 8. Deactivate current active version
    await this.versionRepo.update(
      { familyId, isActive: true },
      { isActive: false },
    );

    // 9. Create new schedule version
    const latest = await this.versionRepo.findOne({
      where: { familyId },
      order: { version: 'DESC' },
    });
    const nextVersion = (latest?.version || 0) + 1;

    const version = await this.versionRepo.save(
      this.versionRepo.create({
        familyId,
        version: nextVersion,
        constraintSetVersion: constraintSet.version,
        horizonStart,
        horizonEnd,
        solverStatus: solverResponse.status,
        solverMetadata: {
          solveTimeMs: solverResponse.solve_time_ms,
          solutionCount: solverResponse.solutions.length,
          metrics: bestSolution.metrics,
          penalties: bestSolution.penalties,
        },
        createdBy: ScheduleSource.GENERATION,
        isActive: true,
      }),
    );

    // 10. Save overnight assignments
    const assignmentEntities: Partial<OvernightAssignment>[] = bestSolution.assignments.map(
      (a: { date: string; parent: string; is_transition: boolean }) => ({
        scheduleVersionId: version.id,
        familyId,
        date: a.date,
        assignedTo: a.parent,
        isTransition: a.is_transition,
        source: AssignmentSource.GENERATED,
      }),
    );
    await this.assignmentRepo.save(assignmentEntities);

    // 11. Generate handoff events on transition days
    const handoffs: Partial<HandoffEvent>[] = [];
    for (const a of assignmentEntities) {
      if (a.isTransition) {
        const fromParent = a.assignedTo === ParentRole.PARENT_A
          ? ParentRole.PARENT_B
          : ParentRole.PARENT_A;
        handoffs.push({
          scheduleVersionId: version.id,
          familyId,
          date: a.date,
          type: HandoffType.DAYCARE_DROPOFF,
          fromParent,
          toParent: a.assignedTo as string,
        });
      }
    }
    if (handoffs.length > 0) {
      await this.handoffRepo.save(handoffs);
    }

    // 12. Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: AuditAction.SCHEDULE_GENERATED,
        entityType: AuditEntityType.SCHEDULE,
        entityId: version.id,
        metadata: {
          source: 'solver',
          solverStatus: solverResponse.status,
          solveTimeMs: solverResponse.solve_time_ms,
          assignmentCount: assignmentEntities.length,
          constraintSetVersion: constraintSet.version,
        },
      }),
    );

    this.logger.log(
      `Generated schedule v${nextVersion} for family ${familyId}: ${solverResponse.status} in ${solverResponse.solve_time_ms}ms`,
    );

    // Fire-and-forget Google Calendar sync
    this.googleCalendarSyncService.syncScheduleForFamily(familyId).catch((err) => {
      this.logger.warn(`Google Calendar sync failed: ${err.message}`);
    });

    this.eventEmitter.emit('schedule.activated', { familyId });

    return version;
  }

  async createManualSchedule(
    familyId: string,
    userId: string,
    assignments: Array<{ date: string; assignedTo: string }>,
  ): Promise<BaseScheduleVersion> {
    await this.versionRepo.update(
      { familyId, isActive: true },
      { isActive: false },
    );

    const latest = await this.versionRepo.findOne({
      where: { familyId },
      order: { version: 'DESC' },
    });
    const nextVersion = (latest?.version || 0) + 1;

    const dates = assignments.map((a) => a.date).sort();
    const version = await this.versionRepo.save(
      this.versionRepo.create({
        familyId,
        version: nextVersion,
        constraintSetVersion: 1,
        horizonStart: dates[0],
        horizonEnd: dates[dates.length - 1],
        solverStatus: 'manual',
        solverMetadata: null,
        createdBy: ScheduleSource.MANUAL_OVERRIDE,
        isActive: true,
      }),
    );

    const sorted = [...assignments].sort((a, b) => a.date.localeCompare(b.date));
    const assignmentEntities: Partial<OvernightAssignment>[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const prev = i > 0 ? sorted[i - 1].assignedTo : null;
      assignmentEntities.push({
        scheduleVersionId: version.id,
        familyId,
        date: sorted[i].date,
        assignedTo: sorted[i].assignedTo,
        isTransition: prev !== null && prev !== sorted[i].assignedTo,
        source: AssignmentSource.MANUAL,
      });
    }
    await this.assignmentRepo.save(assignmentEntities);

    const handoffs: Partial<HandoffEvent>[] = [];
    for (const a of assignmentEntities) {
      if (a.isTransition) {
        const fromParent = a.assignedTo === ParentRole.PARENT_A
          ? ParentRole.PARENT_B
          : ParentRole.PARENT_A;
        handoffs.push({
          scheduleVersionId: version.id,
          familyId,
          date: a.date,
          type: HandoffType.DAYCARE_DROPOFF,
          fromParent,
          toParent: a.assignedTo as string,
        });
      }
    }
    if (handoffs.length > 0) {
      await this.handoffRepo.save(handoffs);
    }

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: AuditAction.SCHEDULE_GENERATED,
        entityType: AuditEntityType.SCHEDULE,
        entityId: version.id,
        metadata: { source: 'manual', assignmentCount: assignments.length },
      }),
    );

    // Fire-and-forget Google Calendar sync
    this.googleCalendarSyncService.syncScheduleForFamily(familyId).catch((err) => {
      this.logger.warn(`Google Calendar sync failed: ${err.message}`);
    });

    this.eventEmitter.emit('schedule.activated', { familyId });

    return version;
  }

  async getScheduleHistory(familyId: string): Promise<BaseScheduleVersion[]> {
    return this.versionRepo.find({
      where: { familyId },
      order: { version: 'DESC' },
    });
  }

  private async getHolidayEntries(
    familyId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ date: string; label: string; daycareClosed: boolean }>> {
    const calendars = await this.holidayRepo.find({ where: { familyId } });
    const entries: Array<{ date: string; label: string; daycareClosed: boolean }> = [];
    for (const cal of calendars) {
      for (const entry of cal.entries as Array<{ date: string; label: string; daycareClosed: boolean }>) {
        if (entry.date >= startDate && entry.date <= endDate) {
          entries.push(entry);
        }
      }
    }
    return entries;
  }
}
