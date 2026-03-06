import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Request,
  ProposalBundle,
  AuditLog,
  FamilyMembership,
} from '../entities';
import {
  RequestStatus,
  AuditAction,
  AuditEntityType,
  NotificationType,
  MAX_OBJECTION_ROUNDS,
  buildGuidedBundle,
  GuidedProposalResponse,
  StructuredFeedback,
  MemberRole,
} from '@adcp/shared';
import { ProposalsService } from '../proposals/proposals.service';
import { NotificationService } from '../notifications/notification.service';
import { FamilyGateway } from '../notifications/family.gateway';
import { FeedbackService } from '../feedback/feedback.service';

@Injectable()
export class MediationService {
  private readonly logger = new Logger(MediationService.name);

  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    @InjectRepository(ProposalBundle)
    private readonly bundleRepo: Repository<ProposalBundle>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(FamilyMembership)
    private readonly membershipRepo: Repository<FamilyMembership>,
    private readonly proposalsService: ProposalsService,
    private readonly notificationService: NotificationService,
    private readonly familyGateway: FamilyGateway,
    private readonly feedbackService: FeedbackService,
  ) {}

  /**
   * Returns guided proposals with fairness explanations for a request.
   */
  async getGuidedProposals(
    familyId: string,
    requestId: string,
  ): Promise<GuidedProposalResponse[]> {
    const bundle = await this.bundleRepo.findOne({
      where: { requestId, familyId },
      relations: ['options'],
      order: { createdAt: 'DESC' },
    });
    if (!bundle || !bundle.options?.length) {
      throw new NotFoundException('No proposals found for this request');
    }

    const request = await this.requestRepo.findOne({
      where: { id: requestId, familyId },
    });
    if (!request) throw new NotFoundException('Request not found');

    return buildGuidedBundle(bundle.options as any, request.dates);
  }

  /**
   * Handles an objection: submits feedback, regenerates proposals with adjusted weights.
   */
  async handleObjection(
    familyId: string,
    requestId: string,
    userId: string,
    feedbacks: StructuredFeedback[],
    declinedOptionIds: string[],
  ): Promise<ProposalBundle> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId, familyId },
    });
    if (!request) throw new NotFoundException('Request not found');

    // Check objection round limit
    const currentRound = await this.feedbackService.getObjectionRound(requestId);
    if (currentRound >= MAX_OBJECTION_ROUNDS) {
      throw new BadRequestException(
        `Maximum objection rounds (${MAX_OBJECTION_ROUNDS}) reached. Please discuss directly with your co-parent.`,
      );
    }

    const nextRound = currentRound + 1;

    // Submit feedback
    await this.feedbackService.submitFeedback(
      familyId,
      userId,
      feedbacks,
      requestId,
      declinedOptionIds[0],
      nextRound,
    );

    // Reset request status to pending for regeneration
    await this.requestRepo.update(requestId, {
      status: RequestStatus.PENDING,
    } as any);

    // Regenerate proposals (ProposalsService will apply feedback-adjusted weights)
    const newBundle = await this.proposalsService.generateProposals(familyId, requestId);

    // Audit
    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: AuditAction.OBJECTION_FILED,
        entityType: AuditEntityType.REQUEST,
        entityId: requestId,
        metadata: {
          round: nextRound,
          feedbackCount: feedbacks.length,
          declinedOptionIds,
          newBundleId: newBundle.id,
        },
      }),
    );

    // Notify the requesting parent of new proposals
    this.notifyOtherParent(familyId, userId, NotificationType.PROPOSALS_REGENERATED, {
      requestId,
      bundleId: newBundle.id,
      round: nextRound,
      referenceId: newBundle.id,
    });

    this.familyGateway.emitProposalReceived(familyId, {
      requestId,
      bundleId: newBundle.id,
      event: 'proposals_regenerated',
      round: nextRound,
    });

    return newBundle;
  }

  /**
   * Accepts a proposal option and notifies all parties.
   */
  async acceptWithNotification(
    familyId: string,
    optionId: string,
    userId: string,
  ) {
    const acceptance = await this.proposalsService.acceptProposal(
      familyId,
      optionId,
      userId,
    );

    // Notify + WebSocket
    this.notifyOtherParent(familyId, userId, NotificationType.PROPOSAL_ACCEPTED, {
      optionId,
      resultingVersionId: acceptance.resultingVersionId,
      referenceId: acceptance.id,
    });

    this.familyGateway.emitScheduleUpdated(familyId, {
      versionId: acceptance.resultingVersionId,
      source: 'proposal_acceptance',
    });

    this.familyGateway.emitProposalAccepted(familyId, {
      acceptanceId: acceptance.id,
      optionId,
    });

    return acceptance;
  }

  /**
   * Declines all proposals for a request, optionally with feedback.
   */
  async declineWithFeedback(
    familyId: string,
    requestId: string,
    userId: string,
    feedbacks?: StructuredFeedback[],
  ) {
    if (feedbacks && feedbacks.length > 0) {
      await this.feedbackService.submitFeedback(
        familyId,
        userId,
        feedbacks,
        requestId,
      );
    }

    const request = await this.proposalsService.declineProposal(
      familyId,
      requestId,
      userId,
    );

    // Notify requesting parent
    this.notifyOtherParent(familyId, userId, NotificationType.PROPOSAL_EXPIRED, {
      requestId,
      reason: 'declined',
      referenceId: requestId,
    });

    return request;
  }

  /**
   * Fire-and-forget notification to the other parent in the family.
   */
  private async notifyOtherParent(
    familyId: string,
    actorUserId: string,
    type: NotificationType,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      const members = await this.membershipRepo.find({
        where: { familyId },
      });
      const otherParents = members.filter(
        (m) =>
          m.userId &&
          m.userId !== actorUserId &&
          (m.role === MemberRole.PARENT_A || m.role === MemberRole.PARENT_B),
      );

      for (const parent of otherParents) {
        await this.notificationService.send(familyId, parent.userId!, type, data);
      }
    } catch (err: any) {
      this.logger.warn(`Notification send failed (non-blocking): ${err.message}`);
    }
  }
}
