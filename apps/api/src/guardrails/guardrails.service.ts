import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PreConsentRule,
  ChangeBudgetLedger,
  EmergencyMode,
  AuditLog,
} from '../entities';
import {
  ConsentRuleType,
  EmergencyModeStatus,
  AuditAction,
  AuditEntityType,
  DEFAULT_CHANGE_BUDGET_PER_MONTH,
} from '@adcp/shared';
import { FamilyContextService } from '../family-context/family-context.service';

@Injectable()
export class GuardrailsService {
  private readonly logger = new Logger(GuardrailsService.name);

  constructor(
    @InjectRepository(PreConsentRule)
    private readonly ruleRepo: Repository<PreConsentRule>,
    @InjectRepository(ChangeBudgetLedger)
    private readonly budgetRepo: Repository<ChangeBudgetLedger>,
    @InjectRepository(EmergencyMode)
    private readonly emergencyRepo: Repository<EmergencyMode>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly familyContextService: FamilyContextService,
  ) {}

  // ─── Consent Rules CRUD ────────────────────────────────────

  async getConsentRules(familyId: string): Promise<PreConsentRule[]> {
    return this.ruleRepo.find({
      where: { familyId, isActive: true },
      order: { createdAt: 'ASC' },
    });
  }

  async addConsentRule(
    familyId: string,
    userId: string,
    dto: { ruleType: string; threshold: Record<string, unknown> },
  ): Promise<PreConsentRule> {
    const rule = await this.ruleRepo.save(
      this.ruleRepo.create({
        familyId,
        createdBy: userId,
        ruleType: dto.ruleType,
        threshold: dto.threshold,
        isActive: true,
      }),
    );

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: AuditAction.CONSENT_RULE_CHANGED,
        entityType: AuditEntityType.CONSENT_RULE,
        entityId: rule.id,
        metadata: { operation: 'add', ruleType: dto.ruleType },
      }),
    );

    return rule;
  }

  async updateConsentRule(
    familyId: string,
    ruleId: string,
    dto: { threshold?: Record<string, unknown>; isActive?: boolean },
  ): Promise<PreConsentRule> {
    const rule = await this.ruleRepo.findOne({
      where: { id: ruleId, familyId },
    });
    if (!rule) throw new NotFoundException('Consent rule not found');

    if (dto.threshold !== undefined) rule.threshold = dto.threshold;
    if (dto.isActive !== undefined) rule.isActive = dto.isActive;

    return this.ruleRepo.save(rule);
  }

  async removeConsentRule(
    familyId: string,
    ruleId: string,
    userId: string,
  ): Promise<void> {
    const rule = await this.ruleRepo.findOne({
      where: { id: ruleId, familyId },
    });
    if (!rule) throw new NotFoundException('Consent rule not found');

    await this.ruleRepo.update(ruleId, { isActive: false } as any);

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: AuditAction.CONSENT_RULE_CHANGED,
        entityType: AuditEntityType.CONSENT_RULE,
        entityId: ruleId,
        metadata: { operation: 'remove' },
      }),
    );
  }

  async evaluateAutoApproval(
    option: {
      penaltyScore?: number;
      fairnessImpact?: Record<string, any>;
      stabilityImpact?: Record<string, any>;
    },
    rules: PreConsentRule[],
    familyId?: string,
  ): Promise<boolean> {
    if (rules.length === 0) return false;

    // Get age-appropriate maxConsecutive fallback
    let ageMaxConsecutive = 5; // hardcoded fallback if no familyId
    if (familyId) {
      const ctx = await this.familyContextService.getContext(familyId);
      ageMaxConsecutive = ctx.maxConsecutive;
    }

    for (const rule of rules) {
      const threshold = rule.threshold as Record<string, any>;
      switch (rule.ruleType) {
        case ConsentRuleType.FAIRNESS_BAND:
          if (
            option.fairnessImpact &&
            Math.abs(option.fairnessImpact.overnight_delta ?? option.fairnessImpact.overnightDelta ?? 999) >
              (threshold.maxDelta ?? 2)
          ) {
            return false;
          }
          break;
        case ConsentRuleType.MAX_TRANSITIONS:
          if (
            option.stabilityImpact &&
            (option.stabilityImpact.additional_transitions ?? option.stabilityImpact.additionalTransitions ?? 0) >
              (threshold.maxAdditional ?? 2)
          ) {
            return false;
          }
          break;
        case ConsentRuleType.MAX_STREAK:
          if (
            option.stabilityImpact &&
            (option.stabilityImpact.max_consecutive ?? option.stabilityImpact.maxConsecutive ?? 0) >
              (threshold.maxStreak ?? ageMaxConsecutive)
          ) {
            return false;
          }
          break;
      }
    }

    return true;
  }

  // ─── Change Budgets ────────────────────────────────────────

  async getBudgetStatus(familyId: string) {
    const month = new Date().toISOString().slice(0, 7) + '-01';
    const budgets = await this.budgetRepo.find({
      where: { familyId, month },
    });

    return budgets.map((b) => ({
      userId: b.userId,
      month: b.month,
      budgetLimit: b.budgetLimit,
      used: b.used,
      remaining: b.budgetLimit - b.used,
    }));
  }

  async resetMonthlyBudgets(): Promise<number> {
    const month = new Date().toISOString().slice(0, 7) + '-01';
    const result = await this.budgetRepo
      .createQueryBuilder()
      .update(ChangeBudgetLedger)
      .set({ used: 0, month, budgetLimit: DEFAULT_CHANGE_BUDGET_PER_MONTH })
      .where('month < :month', { month })
      .execute();

    this.logger.log(`Monthly budget reset: ${result.affected} rows`);
    return result.affected || 0;
  }

  // ─── Emergency Mode ────────────────────────────────────────

  async activateEmergency(
    familyId: string,
    userId: string,
    dto: {
      returnToBaselineAt: string;
      relaxedConstraints?: Array<{ constraintId: string; originalValue: Record<string, unknown> }>;
    },
  ): Promise<EmergencyMode> {
    const existing = await this.emergencyRepo.findOne({
      where: { familyId, status: EmergencyModeStatus.ACTIVE },
    });
    if (existing) {
      throw new BadRequestException('An emergency mode is already active for this family');
    }

    const emergency = await this.emergencyRepo.save(
      this.emergencyRepo.create({
        familyId,
        activatedBy: userId,
        returnToBaselineAt: dto.returnToBaselineAt,
        relaxedConstraints: (dto.relaxedConstraints || []) as any,
        status: EmergencyModeStatus.ACTIVE,
      }),
    );

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: AuditAction.EMERGENCY_ACTIVATED,
        entityType: AuditEntityType.EMERGENCY,
        entityId: emergency.id,
        metadata: {
          returnToBaselineAt: dto.returnToBaselineAt,
          relaxedConstraintCount: (dto.relaxedConstraints || []).length,
        },
      }),
    );

    return emergency;
  }

  async getEmergencyStatus(familyId: string): Promise<EmergencyMode | null> {
    return this.emergencyRepo.findOne({
      where: { familyId, status: EmergencyModeStatus.ACTIVE },
    });
  }

  async updateEmergency(
    familyId: string,
    dto: { returnToBaselineAt?: string },
  ): Promise<EmergencyMode> {
    const emergency = await this.emergencyRepo.findOne({
      where: { familyId, status: EmergencyModeStatus.ACTIVE },
    });
    if (!emergency) throw new NotFoundException('No active emergency mode');

    if (dto.returnToBaselineAt) {
      emergency.returnToBaselineAt = dto.returnToBaselineAt;
    }

    return this.emergencyRepo.save(emergency);
  }

  async cancelEmergency(
    familyId: string,
    userId: string,
  ): Promise<EmergencyMode> {
    const emergency = await this.emergencyRepo.findOne({
      where: { familyId, status: EmergencyModeStatus.ACTIVE },
    });
    if (!emergency) throw new NotFoundException('No active emergency mode');

    emergency.status = EmergencyModeStatus.CANCELLED;
    emergency.returnedAt = new Date();
    const saved = await this.emergencyRepo.save(emergency);

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: AuditAction.EMERGENCY_RETURNED,
        entityType: AuditEntityType.EMERGENCY,
        entityId: emergency.id,
        metadata: { method: 'cancelled' },
      }),
    );

    return saved;
  }

  async returnFromEmergency(emergencyId: string): Promise<void> {
    const emergency = await this.emergencyRepo.findOne({
      where: { id: emergencyId },
    });
    if (!emergency || emergency.status !== EmergencyModeStatus.ACTIVE) return;

    emergency.status = EmergencyModeStatus.RETURNED;
    emergency.returnedAt = new Date();
    await this.emergencyRepo.save(emergency);

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId: emergency.familyId,
        actorId: null,
        action: AuditAction.EMERGENCY_RETURNED,
        entityType: AuditEntityType.EMERGENCY,
        entityId: emergency.id,
        metadata: { method: 'scheduled_return' },
      }),
    );

    this.logger.log(`Emergency ${emergencyId} returned to baseline`);
  }

  async checkExpiredEmergencies(): Promise<number> {
    const now = new Date().toISOString().split('T')[0];
    const active = await this.emergencyRepo.find({
      where: { status: EmergencyModeStatus.ACTIVE },
    });

    let count = 0;
    for (const e of active) {
      if (e.returnToBaselineAt <= now) {
        await this.returnFromEmergency(e.id);
        count++;
      }
    }
    return count;
  }
}
