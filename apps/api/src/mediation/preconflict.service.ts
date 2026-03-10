import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FamilyMembership } from '../entities';
import {
  runPreConflictChecks,
  PreConflictAlert,
  NotificationType,
  LedgerWindowType,
  DEFAULT_FAIRNESS_BAND,
  MemberRole,
} from '@adcp/shared';
import { MetricsService } from '../metrics/metrics.service';
import { GuardrailsService } from '../guardrails/guardrails.service';
import { FamilyContextService } from '../family-context/family-context.service';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class PreConflictService {
  private readonly logger = new Logger(PreConflictService.name);

  constructor(
    @InjectRepository(FamilyMembership)
    private readonly membershipRepo: Repository<FamilyMembership>,
    private readonly metricsService: MetricsService,
    private readonly guardrailsService: GuardrailsService,
    private readonly familyContextService: FamilyContextService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Checks a single family for pre-conflict conditions.
   */
  async checkFamily(
    familyId: string,
    referenceDate: string,
  ): Promise<PreConflictAlert[]> {
    // Get 8-week ledger
    const ledger = await this.metricsService.getLedger(familyId, [
      LedgerWindowType.EIGHT_WEEK,
    ]);
    const ledgerSnap = ledger.length > 0 ? ledger[0] : null;

    // Get stability
    const now = new Date(referenceDate);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 14);
    const stability = await this.metricsService.getStability(
      familyId,
      weekStart.toISOString().split('T')[0],
      referenceDate,
    );

    // Get budget status
    const budgetStatuses = await this.guardrailsService.getBudgetStatus(familyId);
    const totalUsed = budgetStatuses.reduce((sum, b) => sum + b.used, 0);
    const totalLimit = budgetStatuses.reduce((sum, b) => sum + b.budgetLimit, 0);

    // Get age-appropriate max consecutive
    const familyCtx = await this.familyContextService.getContext(familyId);

    return runPreConflictChecks({
      familyId,
      referenceDate,
      parentANights: ledgerSnap?.parentAOvernights || 0,
      parentBNights: ledgerSnap?.parentBOvernights || 0,
      windowWeeks: DEFAULT_FAIRNESS_BAND.windowWeeks,
      maxOvernightDelta: DEFAULT_FAIRNESS_BAND.maxOvernightDelta * DEFAULT_FAIRNESS_BAND.windowWeeks,
      maxConsecutiveCurrent: Math.max(
        stability?.maxConsecutiveA || 0,
        stability?.maxConsecutiveB || 0,
      ),
      maxConsecutiveAllowed: familyCtx.maxConsecutive,
      budgetUsed: totalUsed,
      budgetLimit: totalLimit || 4, // fallback
    });
  }

  /**
   * Sends notifications for detected alerts to all family parents.
   */
  async notifyAlerts(
    familyId: string,
    alerts: PreConflictAlert[],
  ): Promise<void> {
    if (alerts.length === 0) return;

    try {
      const members = await this.membershipRepo.find({
        where: { familyId },
      });
      const parents = members.filter(
        (m) =>
          m.userId &&
          (m.role === MemberRole.PARENT_A || m.role === MemberRole.PARENT_B),
      );

      for (const alert of alerts) {
        for (const parent of parents) {
          await this.notificationService.send(
            familyId,
            parent.userId!,
            NotificationType.PRECONFLICT_ALERT,
            {
              alertType: alert.type,
              severity: alert.severity,
              message: alert.message,
              metric: alert.metric,
              currentValue: alert.currentValue,
              thresholdValue: alert.thresholdValue,
              referenceId: familyId,
            },
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(`Pre-conflict notification failed (non-blocking): ${err.message}`);
    }
  }

  /**
   * Runs daily checks for a specific family.
   * Exposed as a callable endpoint for external scheduler / cron.
   */
  async runDailyCheck(
    familyId: string,
    referenceDate: string,
  ): Promise<{ familyId: string; alerts: PreConflictAlert[] }> {
    const alerts = await this.checkFamily(familyId, referenceDate);
    await this.notifyAlerts(familyId, alerts);
    return { familyId, alerts };
  }
}
