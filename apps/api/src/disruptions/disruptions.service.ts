import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import {
  DisruptionEvent,
  OverlayPolicyEntity,
  PolicyDecisionRecord,
  AuditLog,
} from '../entities';
import {
  DisruptionScope,
  DisruptionSource,
  OverrideStrength,
  OverlayActionType,
  PolicySource,
  resolvePolicy,
  computeOverlay,
  toSolverPayload,
  evaluateForPromotion,
  buildLearnedPolicy,
  type OverlayPolicy,
  type DisruptionOverlayResult,
  type SolverPayloadOverlay,
  type CurrentAssignment,
  type PromotionEligibility,
  type LearnedPolicyDraft,
} from '@adcp/shared';
import { CreateDisruptionDto, CreatePolicyDto } from './dto';

@Injectable()
export class DisruptionsService {
  private readonly logger = new Logger(DisruptionsService.name);

  constructor(
    @InjectRepository(DisruptionEvent)
    private readonly eventRepo: Repository<DisruptionEvent>,
    @InjectRepository(OverlayPolicyEntity)
    private readonly policyRepo: Repository<OverlayPolicyEntity>,
    @InjectRepository(PolicyDecisionRecord)
    private readonly decisionRepo: Repository<PolicyDecisionRecord>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  // ─── Disruption Events ──────────────────────────────────────────

  async reportDisruption(
    familyId: string,
    userId: string,
    dto: CreateDisruptionDto,
  ): Promise<DisruptionEvent> {
    const event = await this.eventRepo.save(
      this.eventRepo.create({
        familyId,
        type: dto.type,
        scope: dto.scope || DisruptionScope.HOUSEHOLD,
        source: DisruptionSource.USER_DECLARED,
        overrideStrength: dto.overrideStrength || OverrideStrength.NONE,
        startDate: dto.startDate,
        endDate: dto.endDate,
        metadata: dto.metadata || {},
        reportedBy: userId,
      }),
    );

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: 'disruption.reported',
        entityType: 'disruption_event',
        entityId: event.id,
        metadata: { type: dto.type, startDate: dto.startDate, endDate: dto.endDate },
      }),
    );

    this.logger.log(`Disruption reported: ${dto.type} for family ${familyId}`);
    return event;
  }

  async resolveDisruption(
    familyId: string,
    eventId: string,
    userId: string,
  ): Promise<DisruptionEvent> {
    const event = await this.eventRepo.findOne({
      where: { id: eventId, familyId },
    });
    if (!event) throw new NotFoundException('Disruption event not found');

    event.resolvedAt = new Date();
    await this.eventRepo.save(event);

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: 'disruption.resolved',
        entityType: 'disruption_event',
        entityId: event.id,
      }),
    );

    return event;
  }

  async getActiveDisruptions(familyId: string): Promise<DisruptionEvent[]> {
    return this.eventRepo.find({
      where: { familyId, resolvedAt: IsNull() },
      order: { startDate: 'ASC' },
    });
  }

  /**
   * Get count of schedule changes in a rolling window for stability budget.
   */
  async getRecentScheduleChanges(
    familyId: string,
    windowDays: number = 28,
  ): Promise<{ changedDays: number; windowStart: string; windowEnd: string }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowDays * 24 * 3600_000);

    // Query audit log for schedule changes in the window
    const changes = await this.auditRepo.find({
      where: {
        familyId,
        action: In(['proposal.accepted', 'schedule_generated']),
      },
      order: { createdAt: 'DESC' },
    });

    const recentChanges = changes.filter(
      (c) => new Date(c.createdAt) >= windowStart,
    );

    return {
      changedDays: recentChanges.length,
      windowStart: windowStart.toISOString().split('T')[0],
      windowEnd: now.toISOString().split('T')[0],
    };
  }

  // ─── Overlay Policies ───────────────────────────────────────────

  async getOverlayPolicies(familyId: string): Promise<OverlayPolicy[]> {
    // Merge: global defaults (familyId=null) + family-specific
    const dbPolicies = await this.policyRepo.find({
      where: [
        { familyId: IsNull(), isActive: true },
        { familyId, isActive: true },
      ],
    });

    return dbPolicies.map((p) => this.toSharedPolicy(p));
  }

  async setFamilyPolicy(
    familyId: string,
    userId: string,
    dto: CreatePolicyDto,
  ): Promise<OverlayPolicyEntity> {
    // Deactivate existing family-specific policy for this event type
    await this.policyRepo.update(
      { familyId, appliesToEventType: dto.appliesToEventType, source: PolicySource.FAMILY_SPECIFIC },
      { isActive: false } as any,
    );

    const policy = await this.policyRepo.save(
      this.policyRepo.create({
        familyId,
        appliesToEventType: dto.appliesToEventType,
        actionType: dto.actionType,
        defaultStrength: dto.defaultStrength || OverrideStrength.SOFT,
        promptingRules: dto.promptingRules || { leadTimeHours: 24, suppressPrompt: false, maxAutoApply: 0 },
        fairnessAccounting: dto.fairnessAccounting || { countsTowardFairness: true, createCompensatory: false, maxCompensatoryDays: 0 },
        source: PolicySource.FAMILY_SPECIFIC,
        isActive: true,
      }),
    );

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: 'policy.created',
        entityType: 'overlay_policy',
        entityId: policy.id,
        metadata: { eventType: dto.appliesToEventType, actionType: dto.actionType },
      }),
    );

    return policy;
  }

  // ─── Overlay Computation ────────────────────────────────────────

  async computeOverlayForEvent(
    familyId: string,
    eventId: string,
    currentAssignments: CurrentAssignment[],
  ): Promise<DisruptionOverlayResult> {
    const event = await this.eventRepo.findOne({
      where: { id: eventId, familyId },
    });
    if (!event) throw new NotFoundException('Disruption event not found');

    const policies = await this.getOverlayPolicies(familyId);
    const resolved = resolvePolicy(event.type as any, policies);

    return computeOverlay(
      {
        id: event.id,
        familyId: event.familyId,
        type: event.type as any,
        scope: event.scope as any,
        source: event.source as any,
        overrideStrength: event.overrideStrength as any,
        startDate: event.startDate,
        endDate: event.endDate,
        metadata: event.metadata,
        reportedBy: event.reportedBy,
        resolvedAt: event.resolvedAt?.toISOString() ?? null,
      },
      resolved,
      currentAssignments,
    );
  }

  /**
   * Compute overlays for all active disruptions and merge into solver payload.
   */
  async computeAllOverlays(
    familyId: string,
    currentAssignments: CurrentAssignment[],
  ): Promise<SolverPayloadOverlay> {
    const events = await this.getActiveDisruptions(familyId);
    if (events.length === 0) {
      return { disruption_locks: [], weight_adjustments: {}, disruption_context: [] };
    }

    const policies = await this.getOverlayPolicies(familyId);
    const overlays: DisruptionOverlayResult[] = [];

    for (const event of events) {
      const resolved = resolvePolicy(event.type as any, policies);
      const overlay = computeOverlay(
        {
          id: event.id,
          familyId: event.familyId,
          type: event.type as any,
          scope: event.scope as any,
          source: event.source as any,
          overrideStrength: event.overrideStrength as any,
          startDate: event.startDate,
          endDate: event.endDate,
          metadata: event.metadata,
          reportedBy: event.reportedBy,
          resolvedAt: event.resolvedAt?.toISOString() ?? null,
        },
        resolved,
        currentAssignments,
      );
      overlays.push(overlay);
    }

    return toSolverPayload(overlays);
  }

  // ─── Policy Learning ─────────────────────────────────────────────

  async recordDecision(
    familyId: string,
    disruptionEventId: string,
    policyId: string,
    actionTaken: string,
    accepted: boolean,
    userId: string | null,
  ): Promise<PolicyDecisionRecord> {
    const record = await this.decisionRepo.save(
      this.decisionRepo.create({
        familyId,
        disruptionEventId,
        policyId,
        actionTaken,
        accepted,
        decidedBy: userId,
        metadata: {},
      }),
    );

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: 'policy.decision_recorded',
        entityType: 'policy_decision_record',
        entityId: record.id,
        metadata: { actionTaken, accepted },
      }),
    );

    return record;
  }

  async checkPromotionEligibility(
    familyId: string,
    eventType: string,
  ): Promise<PromotionEligibility> {
    const records = await this.decisionRepo.find({
      where: { familyId },
      order: { createdAt: 'ASC' },
    });

    // Filter by event type via disruption events
    const eventIds = new Set<string>();
    const events = await this.eventRepo.find({ where: { familyId, type: eventType } });
    for (const e of events) {
      eventIds.add(e.id);
    }

    const filtered = records.filter((r) => eventIds.has(r.disruptionEventId));
    return evaluateForPromotion(eventType as any, filtered as any);
  }

  async promoteToLearnedPolicy(
    familyId: string,
    eventType: string,
    userId: string,
  ): Promise<OverlayPolicyEntity | null> {
    const eligibility = await this.checkPromotionEligibility(familyId, eventType);
    if (!eligibility.eligible) return null;

    const records = await this.decisionRepo.find({
      where: { familyId },
      order: { createdAt: 'ASC' },
    });
    const draft = buildLearnedPolicy(familyId, eligibility, records as any);
    if (!draft) return null;

    // Deactivate existing learned policy for this event type
    await this.policyRepo.update(
      { familyId, appliesToEventType: eventType, source: PolicySource.LEARNED_POLICY },
      { isActive: false } as any,
    );

    const policy = await this.policyRepo.save(
      this.policyRepo.create({
        familyId,
        appliesToEventType: draft.appliesToEventType,
        actionType: draft.actionType,
        defaultStrength: draft.defaultStrength,
        promptingRules: draft.promptingRules as any,
        fairnessAccounting: draft.fairnessAccounting as any,
        source: PolicySource.LEARNED_POLICY,
        isActive: true,
      }),
    );

    await this.auditRepo.save(
      this.auditRepo.create({
        familyId,
        actorId: userId,
        action: 'policy.promoted_to_learned',
        entityType: 'overlay_policy',
        entityId: policy.id,
        metadata: { eventType, basedOnDecisions: draft.basedOnDecisions },
      }),
    );

    this.logger.log(`Promoted learned policy for ${eventType} in family ${familyId}`);
    return policy;
  }

  // ─── Private ────────────────────────────────────────────────────

  private toSharedPolicy(entity: OverlayPolicyEntity): OverlayPolicy {
    return {
      id: entity.id,
      familyId: entity.familyId,
      appliesToEventType: entity.appliesToEventType as any,
      actionType: entity.actionType as any,
      defaultStrength: entity.defaultStrength as any,
      promptingRules: entity.promptingRules as any,
      fairnessAccounting: entity.fairnessAccounting as any,
      source: entity.source as any,
      isActive: entity.isActive,
    };
  }
}
