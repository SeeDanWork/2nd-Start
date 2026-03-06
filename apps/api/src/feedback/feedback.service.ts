import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserFeedback, FeedbackProfile, AuditLog } from '../entities';
import {
  AuditAction,
  AuditEntityType,
  StructuredFeedback,
  WeightDelta,
  computeFeedbackDelta,
  applyFeedbackToWeights,
  accumulateDeltas,
  emptyWeightDelta,
} from '@adcp/shared';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectRepository(UserFeedback)
    private readonly feedbackRepo: Repository<UserFeedback>,
    @InjectRepository(FeedbackProfile)
    private readonly profileRepo: Repository<FeedbackProfile>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async submitFeedback(
    familyId: string,
    userId: string,
    feedbacks: StructuredFeedback[],
    requestId?: string,
    optionId?: string,
    round: number = 0,
  ): Promise<{ feedbackIds: string[]; profile: FeedbackProfile }> {
    const feedbackIds: string[] = [];

    for (const fb of feedbacks) {
      const record = await this.feedbackRepo.save(
        this.feedbackRepo.create({
          familyId,
          userId,
          requestId: requestId || null,
          proposalOptionId: optionId || null,
          category: fb.category,
          severity: fb.severity,
          freeText: fb.freeText || null,
          objectionRound: round,
        }),
      );
      feedbackIds.push(record.id);
    }

    // Update accumulated profile
    const delta = computeFeedbackDelta(feedbacks);
    const profile = await this.upsertProfile(familyId, delta, feedbacks.length);

    // Audit
    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: AuditAction.FEEDBACK_SUBMITTED,
        entityType: AuditEntityType.FEEDBACK,
        entityId: feedbackIds[0],
        metadata: {
          feedbackCount: feedbacks.length,
          requestId,
          optionId,
          round,
        },
      }),
    );

    this.logger.log(
      `Feedback submitted: family=${familyId} user=${userId} count=${feedbacks.length} round=${round}`,
    );

    return { feedbackIds, profile };
  }

  async getProfile(familyId: string): Promise<FeedbackProfile | null> {
    return this.profileRepo.findOne({ where: { familyId } });
  }

  getAdjustedWeights(
    baseWeights: Record<string, number>,
    profile: FeedbackProfile | null,
  ): Record<string, number> {
    if (!profile || !profile.accumulatedDeltas) return baseWeights;

    const delta: WeightDelta = {
      ...emptyWeightDelta(),
      ...profile.accumulatedDeltas,
    };

    return applyFeedbackToWeights(baseWeights, delta);
  }

  async getObjectionRound(requestId: string): Promise<number> {
    const result = await this.feedbackRepo
      .createQueryBuilder('fb')
      .select('MAX(fb.objectionRound)', 'maxRound')
      .where('fb.requestId = :requestId', { requestId })
      .getRawOne();

    return result?.maxRound || 0;
  }

  private async upsertProfile(
    familyId: string,
    delta: WeightDelta,
    count: number,
  ): Promise<FeedbackProfile> {
    let profile = await this.profileRepo.findOne({ where: { familyId } });

    if (!profile) {
      profile = this.profileRepo.create({
        familyId,
        feedbackCount: count,
        accumulatedDeltas: delta as any,
      });
    } else {
      const existingDelta: WeightDelta = {
        ...emptyWeightDelta(),
        ...profile.accumulatedDeltas,
      };
      profile.accumulatedDeltas = accumulateDeltas(existingDelta, delta) as any;
      profile.feedbackCount += count;
    }

    return this.profileRepo.save(profile);
  }
}
