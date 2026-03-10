import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Family, SmsConversation, AuditLog } from '../entities';

/**
 * OperatorService — admin/operator tooling for the SMS pilot.
 *
 * Manages: global SMS kill switch, family pause/resume, conversation
 * inspection, audit traces, rate limiting, and operational metrics.
 */
@Injectable()
export class OperatorService {
  private readonly logger = new Logger(OperatorService.name);

  // In-memory state for pilot (would be Redis in production)
  private smsGlobalPaused = false;
  private smsGlobalPauseReason: string | null = null;
  private smsGlobalPausedAt: Date | null = null;
  private pausedFamilies = new Map<string, { reason: string; pausedAt: Date }>();
  private rateLimitCounters = new Map<string, { inbound: number; outbound: number; windowStart: Date }>();

  constructor(
    @InjectRepository(Family)
    private readonly familyRepo: Repository<Family>,
    @InjectRepository(SmsConversation)
    private readonly conversationRepo: Repository<SmsConversation>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  // ── System Health ──────────────────────────────────────────

  getSystemHealth() {
    return {
      status: 'ok',
      smsEnabled: !this.smsGlobalPaused,
      activeFamilies: this.pausedFamilies.size,
      uptime: process.uptime(),
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      timestamp: new Date().toISOString(),
    };
  }

  async getOperationalMetrics() {
    const totalFamilies = await this.familyRepo.count();
    const activeFamilies = await this.familyRepo.count({ where: { status: 'live' } });
    const totalConversations = await this.conversationRepo.count();
    const activeConversations = await this.conversationRepo
      .createQueryBuilder('c')
      .where("c.state != :state", { state: 'IDLE' })
      .getCount();

    const recentAuditCount = await this.auditLogRepo
      .createQueryBuilder('a')
      .where("a.created_at > :since", { since: new Date(Date.now() - 24 * 60 * 60 * 1000) })
      .getCount();

    return {
      families: { total: totalFamilies, active: activeFamilies },
      conversations: { total: totalConversations, active: activeConversations },
      auditEntries24h: recentAuditCount,
      smsEnabled: !this.smsGlobalPaused,
      pausedFamilies: this.pausedFamilies.size,
      timestamp: new Date().toISOString(),
    };
  }

  // ── SMS Kill Switch ────────────────────────────────────────

  getSmsGlobalStatus() {
    return {
      enabled: !this.smsGlobalPaused,
      paused: this.smsGlobalPaused,
      reason: this.smsGlobalPauseReason,
      pausedAt: this.smsGlobalPausedAt?.toISOString() ?? null,
    };
  }

  pauseGlobalSms(reason: string) {
    this.smsGlobalPaused = true;
    this.smsGlobalPauseReason = reason;
    this.smsGlobalPausedAt = new Date();
    this.logger.warn(`SMS globally paused: ${reason}`);
    return this.getSmsGlobalStatus();
  }

  resumeGlobalSms() {
    this.smsGlobalPaused = false;
    this.smsGlobalPauseReason = null;
    this.smsGlobalPausedAt = null;
    this.logger.log('SMS globally resumed');
    return this.getSmsGlobalStatus();
  }

  /**
   * Check if SMS is allowed for a given family.
   * Used by the conversation orchestrator before processing messages.
   */
  isSmsAllowed(familyId: string): { allowed: boolean; reason?: string } {
    if (this.smsGlobalPaused) {
      return { allowed: false, reason: `Global pause: ${this.smsGlobalPauseReason}` };
    }
    const paused = this.pausedFamilies.get(familyId);
    if (paused) {
      return { allowed: false, reason: `Family paused: ${paused.reason}` };
    }
    return { allowed: true };
  }

  // ── Family Management ──────────────────────────────────────

  async listPilotFamilies(statusFilter?: string) {
    const query = this.familyRepo.createQueryBuilder('f')
      .leftJoinAndSelect('f.children', 'c')
      .leftJoinAndSelect('f.memberships', 'm')
      .leftJoin('m.user', 'u')
      .addSelect(['u.id', 'u.email', 'u.displayName']);

    if (statusFilter) {
      query.where('f.status = :status', { status: statusFilter });
    }

    const families = await query.orderBy('f.created_at', 'DESC').getMany();

    return families.map(f => ({
      id: f.id,
      name: f.name,
      status: f.status,
      timezone: f.timezone,
      childCount: f.children?.length ?? 0,
      memberCount: f.memberships?.length ?? 0,
      smsPaused: this.pausedFamilies.has(f.id),
      smsPauseReason: this.pausedFamilies.get(f.id)?.reason ?? null,
      createdAt: f.createdAt,
    }));
  }

  async getFamilyDetail(familyId: string) {
    const family = await this.familyRepo.findOne({
      where: { id: familyId },
      relations: ['children', 'memberships'],
    });

    if (!family) {
      return null;
    }

    const conversations = await this.conversationRepo.find({
      where: { familyId },
    });

    const recentAudit = await this.auditLogRepo.find({
      where: { familyId } as any,
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const pauseInfo = this.pausedFamilies.get(familyId);

    return {
      family: {
        id: family.id,
        name: family.name,
        status: family.status,
        timezone: family.timezone,
        weekendDefinition: family.weekendDefinition,
        fairnessBand: family.fairnessBand,
        changeBudget: family.changeBudget,
        createdAt: family.createdAt,
      },
      sms: {
        paused: !!pauseInfo,
        pauseReason: pauseInfo?.reason ?? null,
        pausedAt: pauseInfo?.pausedAt?.toISOString() ?? null,
        conversations: conversations.map(c => ({
          phoneNumber: c.phoneNumber,
          state: c.state,
          lastMessageAt: c.lastMessageAt,
        })),
      },
      rateLimit: this.getRateLimitStatus(familyId),
      recentAudit: recentAudit.map(a => ({
        action: a.action,
        actor: a.actorId,
        createdAt: a.createdAt,
      })),
      childCount: family.children?.length ?? 0,
      memberCount: family.memberships?.length ?? 0,
    };
  }

  pauseFamily(familyId: string, reason: string) {
    this.pausedFamilies.set(familyId, { reason, pausedAt: new Date() });
    this.logger.warn(`Family ${familyId} SMS paused: ${reason}`);
    return {
      familyId,
      paused: true,
      reason,
      pausedAt: new Date().toISOString(),
    };
  }

  resumeFamily(familyId: string) {
    this.pausedFamilies.delete(familyId);
    this.logger.log(`Family ${familyId} SMS resumed`);
    return {
      familyId,
      paused: false,
    };
  }

  // ── Conversation Inspection ────────────────────────────────

  async listConversations(familyId?: string) {
    const where = familyId ? { familyId } : {};
    const conversations = await this.conversationRepo.find({
      where,
      order: { lastMessageAt: 'DESC' },
    });

    return conversations.map(c => ({
      id: c.id,
      phoneNumber: c.phoneNumber,
      familyId: c.familyId,
      userId: c.userId,
      state: c.state,
      hasPendingIntent: !!c.pendingIntent,
      pendingIntentType: (c.pendingIntent as any)?.intentType ?? null,
      lastMessageAt: c.lastMessageAt,
      createdAt: c.createdAt,
    }));
  }

  async getConversationHistory(phoneNumber: string, limit: number) {
    const conversation = await this.conversationRepo.findOne({
      where: { phoneNumber },
    });

    if (!conversation) {
      return { phoneNumber, found: false, history: [] };
    }

    // Get audit log entries for this user's SMS actions
    const auditEntries = conversation.userId
      ? await this.auditLogRepo.find({
          where: { actorId: conversation.userId } as any,
          order: { createdAt: 'DESC' },
          take: limit,
        })
      : [];

    return {
      phoneNumber,
      found: true,
      conversation: {
        id: conversation.id,
        state: conversation.state,
        familyId: conversation.familyId,
        userId: conversation.userId,
        pendingIntent: conversation.pendingIntent,
        lastMessageAt: conversation.lastMessageAt,
      },
      auditHistory: auditEntries.map(a => ({
        action: a.action,
        metadata: a.metadata,
        createdAt: a.createdAt,
      })),
    };
  }

  // ── Audit Trace ────────────────────────────────────────────

  async getAuditTrace(familyId: string, limit: number, actionFilter?: string) {
    const query = this.auditLogRepo.createQueryBuilder('a')
      .where('a.family_id = :familyId', { familyId })
      .orderBy('a.created_at', 'DESC')
      .take(limit);

    if (actionFilter) {
      query.andWhere('a.action LIKE :action', { action: `%${actionFilter}%` });
    }

    const entries = await query.getMany();

    return {
      familyId,
      total: entries.length,
      entries: entries.map(a => ({
        id: a.id,
        action: a.action,
        actorId: a.actorId,
        entityType: a.entityType,
        entityId: a.entityId,
        metadata: a.metadata,
        createdAt: a.createdAt,
      })),
    };
  }

  // ── Rate Limiting ──────────────────────────────────────────

  /**
   * Check and increment rate limit counter.
   * Returns whether the message is allowed.
   *
   * Limits per SMS Pilot Contract:
   * - 10 inbound messages per parent per hour
   * - 30 outbound messages per family per hour
   */
  checkRateLimit(
    key: string,
    direction: 'inbound' | 'outbound',
  ): { allowed: boolean; current: number; limit: number } {
    const limit = direction === 'inbound' ? 10 : 30;
    const now = new Date();
    let counter = this.rateLimitCounters.get(key);

    // Reset window if expired (1 hour)
    if (!counter || (now.getTime() - counter.windowStart.getTime()) > 60 * 60 * 1000) {
      counter = { inbound: 0, outbound: 0, windowStart: now };
      this.rateLimitCounters.set(key, counter);
    }

    const current = direction === 'inbound' ? counter.inbound : counter.outbound;
    if (current >= limit) {
      return { allowed: false, current, limit };
    }

    if (direction === 'inbound') counter.inbound++;
    else counter.outbound++;

    return { allowed: true, current: current + 1, limit };
  }

  getRateLimitStatus(familyId: string) {
    const counter = this.rateLimitCounters.get(familyId);
    if (!counter) {
      return {
        familyId,
        inbound: { current: 0, limit: 10, windowStart: null },
        outbound: { current: 0, limit: 30, windowStart: null },
      };
    }

    return {
      familyId,
      inbound: { current: counter.inbound, limit: 10, windowStart: counter.windowStart },
      outbound: { current: counter.outbound, limit: 30, windowStart: counter.windowStart },
    };
  }

  // ── Quiet Hours ────────────────────────────────────────────

  /**
   * Check if current time is within quiet hours for a family.
   * Per SMS Pilot Contract: No SMS between 9pm-8am family timezone unless urgent.
   */
  isQuietHours(timezone: string): boolean {
    try {
      const now = new Date();
      const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const hour = localTime.getHours();
      return hour >= 21 || hour < 8;
    } catch {
      // Default to not quiet if timezone invalid
      return false;
    }
  }
}
