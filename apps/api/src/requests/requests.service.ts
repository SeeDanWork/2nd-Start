import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  Request,
  ChangeBudgetLedger,
  AuditLog,
  OvernightAssignment,
} from '../entities';
import {
  RequestStatus,
  RequestUrgency,
  DEFAULT_CHANGE_BUDGET_PER_MONTH,
  DEFAULT_PROPOSAL_EXPIRY_HOURS,
  URGENT_PROPOSAL_EXPIRY_HOURS,
  interpretChangeRequest,
  type RawChangeRequestInput,
  type InterpreterResult,
  ApplyMode,
} from '@adcp/shared';
import { SchedulesService } from '../schedules/schedules.service';

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    @InjectRepository(ChangeBudgetLedger)
    private readonly budgetRepo: Repository<ChangeBudgetLedger>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(OvernightAssignment)
    private readonly assignmentRepo: Repository<OvernightAssignment>,
    private readonly schedulesService: SchedulesService,
  ) {}

  async create(
    familyId: string,
    userId: string,
    dto: {
      type: string;
      dates: string[];
      reasonTag?: string;
      reasonNote?: string;
      urgency?: string;
    },
  ): Promise<Request> {
    // Check change budget
    const month = new Date().toISOString().slice(0, 7) + '-01';
    let budget = await this.budgetRepo.findOne({
      where: { familyId, userId, month },
    });

    if (!budget) {
      budget = await this.budgetRepo.save(
        this.budgetRepo.create({
          familyId,
          userId,
          month,
          budgetLimit: DEFAULT_CHANGE_BUDGET_PER_MONTH,
          used: 0,
        }),
      );
    }

    if (budget.used >= budget.budgetLimit) {
      throw new BadRequestException(
        `Change budget exhausted (${budget.used}/${budget.budgetLimit} used this month)`,
      );
    }

    const urgency = dto.urgency || RequestUrgency.NORMAL;
    const expiryHours =
      urgency === RequestUrgency.URGENT
        ? URGENT_PROPOSAL_EXPIRY_HOURS
        : DEFAULT_PROPOSAL_EXPIRY_HOURS;

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    const request = await this.requestRepo.save(
      this.requestRepo.create({
        familyId,
        requestedBy: userId,
        type: dto.type,
        status: RequestStatus.PENDING,
        dates: dto.dates,
        reasonTag: dto.reasonTag || null,
        reasonNote: dto.reasonNote || null,
        urgency,
        changeBudgetDebit: 1,
        expiresAt,
      }),
    );

    // Debit budget
    await this.budgetRepo.update(budget.id, { used: budget.used + 1 } as any);

    // Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: 'request.created',
        entityType: 'request',
        entityId: request.id,
        metadata: { type: dto.type, dates: dto.dates, urgency },
      }),
    );

    return request;
  }

  async list(familyId: string, statuses?: string[]): Promise<Request[]> {
    const where: any = { familyId };
    if (statuses && statuses.length > 0) {
      where.status = In(statuses);
    }
    return this.requestRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async get(familyId: string, requestId: string): Promise<Request> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId, familyId },
    });
    if (!request) throw new NotFoundException('Request not found');
    return request;
  }

  async cancel(familyId: string, requestId: string, userId: string): Promise<Request> {
    const request = await this.get(familyId, requestId);

    if (
      request.status !== RequestStatus.PENDING &&
      request.status !== RequestStatus.PROPOSALS_GENERATED
    ) {
      throw new BadRequestException(`Cannot cancel request in status ${request.status}`);
    }

    await this.requestRepo.update(request.id, {
      status: RequestStatus.CANCELLED,
    } as any);

    // Refund budget
    const month = new Date(request.createdAt).toISOString().slice(0, 7) + '-01';
    const budget = await this.budgetRepo.findOne({
      where: { familyId, userId: request.requestedBy, month },
    });
    if (budget && budget.used > 0) {
      await this.budgetRepo.update(budget.id, { used: budget.used - 1 } as any);
    }

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: 'request.cancelled',
        entityType: 'request',
        entityId: request.id,
      }),
    );

    return this.get(familyId, requestId);
  }

  async getImpactPreview(familyId: string, dates: string[]) {
    const active = await this.schedulesService.getActiveSchedule(familyId);
    if (!active) return { affectedDates: [], currentAssignments: [] };

    const assignments = await this.assignmentRepo.find({
      where: {
        familyId,
        scheduleVersionId: active.id,
        date: In(dates),
      },
      order: { date: 'ASC' },
    });

    return {
      affectedDates: assignments.map((a) => ({
        date: a.date,
        currentParent: a.assignedTo,
        isTransition: a.isTransition,
      })),
      totalNightsAffected: assignments.length,
    };
  }

  async getBudget(familyId: string, userId: string) {
    const month = new Date().toISOString().slice(0, 7) + '-01';
    let budget = await this.budgetRepo.findOne({
      where: { familyId, userId, month },
    });

    if (!budget) {
      budget = {
        id: '',
        familyId,
        userId,
        month,
        budgetLimit: DEFAULT_CHANGE_BUDGET_PER_MONTH,
        used: 0,
      };
    }

    return {
      userId,
      month,
      budgetLimit: budget.budgetLimit,
      used: budget.used,
      remaining: budget.budgetLimit - budget.used,
    };
  }

  /**
   * Interpret a change request through the deterministic interpreter.
   * Called before proposal generation to determine apply mode and consent.
   */
  async interpretRequest(
    familyId: string,
    requestId: string,
  ): Promise<InterpreterResult> {
    const request = await this.get(familyId, requestId);
    const active = await this.schedulesService.getActiveSchedule(familyId);

    // Get current and previous assignments for stability budget
    const currentAssignments = active
      ? await this.assignmentRepo.find({
          where: { familyId, scheduleVersionId: active.id },
          order: { date: 'ASC' },
        })
      : [];

    // For stability budget, we need the previous version's assignments
    // Use empty array if no previous version exists
    const previousAssignments: Array<{ date: string; assignedTo: string }> = [];

    const rawRequest: RawChangeRequestInput = {
      id: request.id,
      familyId,
      requestingParent: request.requestedBy as any,
      requestType: request.type as any,
      dates: request.dates,
      createdAt: request.createdAt instanceof Date
        ? request.createdAt.toISOString()
        : String(request.createdAt),
    };

    return interpretChangeRequest({
      rawRequest,
      previousAssignments,
      currentAssignments: currentAssignments.map((a) => ({
        date: a.date,
        assignedTo: a.assignedTo,
      })),
    });
  }
}
