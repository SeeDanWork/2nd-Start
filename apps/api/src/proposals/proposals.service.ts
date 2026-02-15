import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import {
  ProposalBundle,
  ProposalOption,
  Acceptance,
  Request,
  OvernightAssignment,
  BaseScheduleVersion,
  AuditLog,
  ConstraintSet,
  PreConsentRule,
} from '../entities';
import {
  RequestStatus,
  AcceptanceType,
  ConstraintType,
  ParentRole,
  ScheduleSource,
  DEFAULT_PROPOSAL_EXPIRY_HOURS,
  DEFAULT_MAX_TRANSITIONS_PER_WEEK,
  DEFAULT_SOLVER_WEIGHTS,
  SOLVER_TIMEOUT_SECONDS,
  SOLVER_MAX_SOLUTIONS,
  DEFAULT_PROPOSAL_HORIZON_WEEKS,
} from '@adcp/shared';
import { SchedulesService } from '../schedules/schedules.service';

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(
    @InjectRepository(ProposalBundle)
    private readonly bundleRepo: Repository<ProposalBundle>,
    @InjectRepository(ProposalOption)
    private readonly optionRepo: Repository<ProposalOption>,
    @InjectRepository(Acceptance)
    private readonly acceptanceRepo: Repository<Acceptance>,
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    @InjectRepository(OvernightAssignment)
    private readonly assignmentRepo: Repository<OvernightAssignment>,
    @InjectRepository(BaseScheduleVersion)
    private readonly versionRepo: Repository<BaseScheduleVersion>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(ConstraintSet)
    private readonly constraintSetRepo: Repository<ConstraintSet>,
    @InjectRepository(PreConsentRule)
    private readonly preConsentRepo: Repository<PreConsentRule>,
    private readonly httpService: HttpService,
    private readonly schedulesService: SchedulesService,
  ) {}

  async generateProposals(
    familyId: string,
    requestId: string,
  ): Promise<ProposalBundle> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId, familyId },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Request status must be pending, got ${request.status}`);
    }

    const active = await this.schedulesService.getActiveSchedule(familyId);
    if (!active) {
      throw new BadRequestException('No active schedule to generate proposals against');
    }

    // Load constraints
    const constraintSet = await this.constraintSetRepo.findOne({
      where: { familyId, isActive: true },
      relations: ['constraints'],
    });

    // Get current assignments as frozen
    const currentAssignments = await this.assignmentRepo.find({
      where: { familyId, scheduleVersionId: active.id },
      order: { date: 'ASC' },
    });

    // Build proposal solver payload
    const today = new Date();
    const horizonStart = today.toISOString().split('T')[0];
    const horizonEnd = new Date(today);
    horizonEnd.setDate(horizonEnd.getDate() + DEFAULT_PROPOSAL_HORIZON_WEEKS * 7);

    const lockedNights: Array<{ parent: string; days_of_week: number[] }> = [];
    const maxConsecutive: Array<{ parent: string; max_nights: number }> = [];
    let maxTransitionsPerWeek = DEFAULT_MAX_TRANSITIONS_PER_WEEK;

    if (constraintSet) {
      for (const c of constraintSet.constraints) {
        const params = c.parameters as Record<string, any>;
        switch (c.type) {
          case ConstraintType.LOCKED_NIGHT:
            lockedNights.push({ parent: params.parent, days_of_week: params.daysOfWeek });
            break;
          case ConstraintType.MAX_CONSECUTIVE:
            maxConsecutive.push({ parent: params.parent, max_nights: params.maxNights });
            break;
          case ConstraintType.MAX_TRANSITIONS_PER_WEEK:
            maxTransitionsPerWeek = params.maxTransitions || DEFAULT_MAX_TRANSITIONS_PER_WEEK;
            break;
        }
      }
    }

    // Determine request constraint for solver
    const requestParent = request.type === 'need_coverage' ? ParentRole.PARENT_B : ParentRole.PARENT_A;
    const requestConstraints = [{
      type: request.type,
      dates: request.dates,
      parent: requestParent,
      swap_target_dates: [],
    }];

    const solverPayload = {
      horizon_start: horizonStart,
      horizon_end: horizonEnd.toISOString().split('T')[0],
      frozen_assignments: currentAssignments
        .filter((a) => !request.dates.includes(a.date))
        .map((a) => ({ date: a.date, parent: a.assignedTo })),
      request_constraints: requestConstraints,
      locked_nights: lockedNights,
      max_consecutive: maxConsecutive,
      max_transitions_per_week: maxTransitionsPerWeek,
      weights: {
        fairness_deviation: DEFAULT_SOLVER_WEIGHTS.fairnessDeviation,
        total_transitions: DEFAULT_SOLVER_WEIGHTS.totalTransitions,
        non_daycare_handoffs: DEFAULT_SOLVER_WEIGHTS.nonDaycareHandoffs,
        weekend_fragmentation: DEFAULT_SOLVER_WEIGHTS.weekendFragmentation,
        school_night_disruption: DEFAULT_SOLVER_WEIGHTS.schoolNightDisruption,
      },
      timeout_seconds: SOLVER_TIMEOUT_SECONDS,
      max_solutions: SOLVER_MAX_SOLUTIONS,
      current_schedule_hint: currentAssignments.map((a) => ({
        date: a.date,
        parent: a.assignedTo,
      })),
    };

    // Call optimizer
    this.logger.log(`Generating proposals for request ${requestId}`);
    let solverResponse: any;
    try {
      const response = await firstValueFrom(
        this.httpService.post('/solve/proposals', solverPayload),
      );
      solverResponse = response.data;
    } catch (err: any) {
      this.logger.error(`Proposal generation failed: ${err.message}`);
      throw new BadRequestException(
        `Proposal generation failed: ${err.response?.data?.detail || err.message}`,
      );
    }

    if (solverResponse.status === 'infeasible') {
      throw new BadRequestException({
        message: 'No feasible proposals for this request',
        conflicts: solverResponse.conflicting_constraints || [],
      });
    }

    // Check pre-consent rules for auto-approvability
    const preConsentRules = await this.preConsentRepo.find({
      where: { familyId, isActive: true },
    });

    // Create proposal bundle
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + DEFAULT_PROPOSAL_EXPIRY_HOURS);

    const bundle = await this.bundleRepo.save(
      this.bundleRepo.create({
        requestId,
        familyId,
        solverRunId: null,
        generationParams: {
          horizonWeeks: DEFAULT_PROPOSAL_HORIZON_WEEKS,
          maxSolutions: SOLVER_MAX_SOLUTIONS,
          timeoutMs: SOLVER_TIMEOUT_SECONDS * 1000,
        },
        expiresAt,
      }),
    );

    // Save proposal options
    const options: ProposalOption[] = [];
    for (const opt of solverResponse.options || []) {
      const isAutoApprovable = this.checkAutoApprovable(opt, preConsentRules);
      const option = await this.optionRepo.save(
        this.optionRepo.create({
          bundleId: bundle.id,
          rank: opt.rank,
          label: opt.label || `Option ${opt.rank}`,
          calendarDiff: opt.calendar_diff || [],
          fairnessImpact: opt.fairness_impact || {},
          stabilityImpact: opt.stability_impact || {},
          handoffImpact: opt.handoff_impact || {},
          penaltyScore: opt.penalty_score || 0,
          isAutoApprovable,
        }),
      );
      options.push(option);
    }

    // Update request status
    await this.requestRepo.update(request.id, {
      status: RequestStatus.PROPOSALS_GENERATED,
    } as any);

    // Audit
    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: request.requestedBy,
        action: 'proposals.generated',
        entityType: 'proposal_bundle',
        entityId: bundle.id,
        metadata: {
          requestId,
          optionCount: options.length,
          solveTimeMs: solverResponse.solve_time_ms,
        },
      }),
    );

    bundle.options = options;
    return bundle;
  }

  async getProposals(familyId: string, requestId: string): Promise<ProposalBundle | null> {
    return this.bundleRepo.findOne({
      where: { requestId, familyId },
      relations: ['options'],
      order: { createdAt: 'DESC' },
    });
  }

  async acceptProposal(
    familyId: string,
    optionId: string,
    userId: string,
  ): Promise<Acceptance> {
    const option = await this.optionRepo.findOne({
      where: { id: optionId },
      relations: ['bundle'],
    });
    if (!option) throw new NotFoundException('Proposal option not found');
    if (option.bundle.familyId !== familyId) {
      throw new BadRequestException('Option does not belong to this family');
    }

    // Find the associated request
    const request = await this.requestRepo.findOne({
      where: { id: option.bundle.requestId },
    });
    if (!request) throw new NotFoundException('Request not found');

    // Get active schedule
    const active = await this.schedulesService.getActiveSchedule(familyId);
    if (!active) throw new BadRequestException('No active schedule');

    // Apply calendar diff to create new schedule version
    const calendarDiff = option.calendarDiff as Array<{
      date: string;
      old_parent: string;
      new_parent: string;
    }>;

    // Get all current assignments
    const currentAssignments = await this.assignmentRepo.find({
      where: { familyId, scheduleVersionId: active.id },
    });

    // Build new assignment list
    const diffMap = new Map(calendarDiff.map((d) => [d.date, d.new_parent]));
    const newAssignments = currentAssignments.map((a) => ({
      date: a.date,
      assignedTo: diffMap.get(a.date) || a.assignedTo,
    }));

    // Create new version via schedules service
    const newVersion = await this.schedulesService.createManualSchedule(
      familyId,
      userId,
      newAssignments,
    );

    // Update version metadata
    await this.versionRepo.update(newVersion.id, {
      sourceProposalOptionId: optionId,
      createdBy: ScheduleSource.PROPOSAL_ACCEPTANCE,
    } as any);

    // Create acceptance record
    const acceptance = await this.acceptanceRepo.save(
      this.acceptanceRepo.create({
        proposalOptionId: optionId,
        acceptedBy: userId,
        acceptanceType: AcceptanceType.MANUAL,
        resultingVersionId: newVersion.id,
      }),
    );

    // Update request status
    await this.requestRepo.update(request.id, {
      status: RequestStatus.ACCEPTED,
    } as any);

    // Audit
    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: 'proposal.accepted',
        entityType: 'acceptance',
        entityId: acceptance.id,
        metadata: {
          requestId: request.id,
          optionId,
          optionRank: option.rank,
          newVersionId: newVersion.id,
          calendarDiffCount: calendarDiff.length,
        },
      }),
    );

    return acceptance;
  }

  async declineProposal(
    familyId: string,
    requestId: string,
    userId: string,
  ): Promise<Request> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId, familyId },
    });
    if (!request) throw new NotFoundException('Request not found');

    await this.requestRepo.update(request.id, {
      status: RequestStatus.DECLINED,
    } as any);

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: 'proposal.declined',
        entityType: 'request',
        entityId: request.id,
      }),
    );

    return this.requestRepo.findOneOrFail({ where: { id: requestId } });
  }

  private checkAutoApprovable(
    option: any,
    rules: PreConsentRule[],
  ): boolean {
    if (rules.length === 0) return false;

    for (const rule of rules) {
      const threshold = rule.threshold as Record<string, any>;
      switch (rule.ruleType) {
        case 'max_penalty_score':
          if (option.penalty_score <= (threshold.maxScore || 10)) return true;
          break;
        case 'max_overnight_delta':
          if (
            option.fairness_impact &&
            Math.abs(option.fairness_impact.overnight_delta) <= (threshold.maxDelta || 2)
          ) return true;
          break;
      }
    }
    return false;
  }
}
