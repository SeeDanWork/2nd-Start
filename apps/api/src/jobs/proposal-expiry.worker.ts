import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
  ProposalBundle,
  Request,
  AuditLog,
  FamilyMembership,
} from '../entities';
import {
  RequestStatus,
  AuditAction,
  AuditEntityType,
  NotificationType,
  MemberRole,
} from '@adcp/shared';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class ProposalExpiryWorker {
  private readonly logger = new Logger(ProposalExpiryWorker.name);

  constructor(
    @InjectRepository(ProposalBundle)
    private readonly bundleRepo: Repository<ProposalBundle>,
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(FamilyMembership)
    private readonly membershipRepo: Repository<FamilyMembership>,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron('0 */15 * * * *') // Every 15 minutes
  async handleProposalExpiry(): Promise<void> {
    const now = new Date();
    this.logger.debug('Checking for expired proposals...');

    try {
      // Find bundles that have expired
      const expiredBundles = await this.bundleRepo.find({
        where: {
          expiresAt: LessThan(now),
        },
      });

      if (expiredBundles.length === 0) {
        return;
      }

      let expiredCount = 0;

      for (const bundle of expiredBundles) {
        // Check if the associated request is still in proposals_generated status
        const request = await this.requestRepo.findOne({
          where: {
            id: bundle.requestId,
            status: RequestStatus.PROPOSALS_GENERATED,
          },
        });

        if (!request) {
          continue;
        }

        // Update request status to expired
        await this.requestRepo.update(request.id, {
          status: RequestStatus.EXPIRED,
        } as any);

        // Log to audit
        await this.auditRepo.save(
          this.auditRepo.create({
            familyId: request.familyId,
            actorId: null, // system action
            action: AuditAction.PROPOSAL_EXPIRED,
            entityType: AuditEntityType.REQUEST,
            entityId: request.id,
            metadata: {
              bundleId: bundle.id,
              expiredAt: now.toISOString(),
            },
          }),
        );

        // Notify both parents
        await this.notifyParents(request.familyId, request.id, bundle.id);

        expiredCount++;
      }

      if (expiredCount > 0) {
        this.logger.log(`Expired ${expiredCount} proposal(s)`);
      }
    } catch (err: any) {
      this.logger.error(`Proposal expiry check failed: ${err.message}`, err.stack);
    }
  }

  private async notifyParents(
    familyId: string,
    requestId: string,
    bundleId: string,
  ): Promise<void> {
    try {
      const members = await this.membershipRepo.find({
        where: { familyId },
      });
      const parents = members.filter(
        (m) =>
          m.userId &&
          (m.role === MemberRole.PARENT_A || m.role === MemberRole.PARENT_B),
      );

      for (const parent of parents) {
        await this.notificationService.send(
          familyId,
          parent.userId!,
          NotificationType.PROPOSAL_EXPIRED,
          {
            requestId,
            bundleId,
            referenceId: requestId,
          },
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Proposal expiry notification failed (non-blocking): ${err.message}`,
      );
    }
  }
}
