import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  User,
  FamilyMembership,
  MessageLog,
  ConversationSession,
  BaseScheduleVersion,
  OvernightAssignment,
  DisruptionEvent,
  AuditLog,
} from '../entities';
import { MessageDirection, MessageIntent, ParsedIntent } from '@adcp/shared';
import { ConversationService } from './conversation.service';
import { MessageParserService } from './message-parser.service';
import { MessageSenderService } from './message-sender.service';
import { helpMessage } from './templates/help';
import { unknownMessage } from './templates/unknown';
import { errorMessage } from './templates/error';
import { SwapFlowService } from './swap-flow.service';
import { ViewerTokenService } from './viewer-token.service';
import { formatWeekSchedule, formatDaySchedule } from './schedule-formatter';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageParserService: MessageParserService,
    private readonly messageSenderService: MessageSenderService,
    private readonly swapFlowService: SwapFlowService,
    private readonly viewerTokenService: ViewerTokenService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(FamilyMembership)
    private readonly membershipRepo: Repository<FamilyMembership>,
    @InjectRepository(MessageLog)
    private readonly messageLogRepo: Repository<MessageLog>,
    @InjectRepository(BaseScheduleVersion)
    private readonly scheduleVersionRepo: Repository<BaseScheduleVersion>,
    @InjectRepository(OvernightAssignment)
    private readonly assignmentRepo: Repository<OvernightAssignment>,
    @InjectRepository(DisruptionEvent)
    private readonly disruptionRepo: Repository<DisruptionEvent>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async handleInbound(
    phoneNumber: string,
    body: string,
    channel: string,
    providerMessageId?: string,
  ): Promise<string> {
    try {
      // Find user by phone number
      const user = await this.userRepo.findOne({
        where: { phoneNumber },
      });

      if (!user) {
        return 'This number is not registered with ADCP. Visit our website to set up your account.';
      }

      // Find user's family via membership
      const membership = await this.membershipRepo.findOne({
        where: { userId: user.id },
      });

      if (!membership) {
        return 'Your account is not associated with a family yet. Please complete setup on our website.';
      }

      // Get or create conversation session
      const session = await this.conversationService.getOrCreateSession(
        user.id,
        membership.familyId,
        phoneNumber,
        channel,
      );

      // Parse intent
      const parsed = this.messageParserService.parse(body, session);

      // Log inbound message
      await this.messageLogRepo.save(
        this.messageLogRepo.create({
          conversationSessionId: session.id,
          direction: MessageDirection.INBOUND,
          channel,
          fromNumber: phoneNumber,
          toNumber: '',
          body,
          parsedIntent: parsed as any,
          confidence: parsed.confidence,
          providerMessageId: providerMessageId || null,
          deliveryStatus: 'delivered',
        }),
      );

      // Route by intent
      const response = await this.routeIntent(
        parsed,
        session,
        user,
      );

      // Log outbound message
      await this.messageLogRepo.save(
        this.messageLogRepo.create({
          conversationSessionId: session.id,
          direction: MessageDirection.OUTBOUND,
          channel,
          fromNumber: '',
          toNumber: phoneNumber,
          body: response,
          parsedIntent: null,
          confidence: null,
          providerMessageId: null,
          deliveryStatus: 'sent',
        }),
      );

      return response;
    } catch (err) {
      this.logger.error(`Error handling inbound message: ${err}`);
      return errorMessage();
    }
  }

  async updateDeliveryStatus(
    providerMessageId: string,
    status: string,
  ): Promise<void> {
    const log = await this.messageLogRepo.findOne({
      where: { providerMessageId },
    });

    if (log) {
      await this.messageLogRepo.update(log.id, {
        deliveryStatus: status,
      } as any);
    }
  }

  /**
   * Route a parsed intent to the appropriate handler.
   * New intents are added here as conversation flows are built.
   */
  private async routeIntent(
    parsed: ParsedIntent,
    session: ConversationSession,
    user: User,
  ): Promise<string> {
    // Check for context-dependent intents first (APPROVE / DECLINE)
    if (
      parsed.intent === MessageIntent.APPROVE ||
      parsed.intent === MessageIntent.DECLINE
    ) {
      return this.handleApproveDecline(
        parsed.intent === MessageIntent.APPROVE,
        session,
        user,
      );
    }

    switch (parsed.intent) {
      case MessageIntent.CONFIRM_SCHEDULE:
        return this.handleConfirmSchedule(parsed.entities, session);

      case MessageIntent.REPORT_DISRUPTION:
        return this.handleReportDisruption(parsed.entities, parsed.rawText, user, session);

      case MessageIntent.REPORT_ILLNESS:
        return this.handleReportIllness(parsed.entities, parsed.rawText, user, session);

      case MessageIntent.REQUEST_SWAP:
        return this.swapFlowService.initiateSwap(session, parsed, user);

      case MessageIntent.HELP:
        return helpMessage();

      case MessageIntent.UNKNOWN:
        return unknownMessage();

      case MessageIntent.VIEW_SCHEDULE:
        return this.handleViewSchedule(session);

      default:
        return unknownMessage();
    }
  }

  /**
   * Handle APPROVE or DECLINE based on the pending action in the session.
   */
  private async handleApproveDecline(
    approved: boolean,
    session: ConversationSession,
    user: User,
  ): Promise<string> {
    const pending = await this.conversationService.getPendingAction(session.id);

    if (!pending) {
      return approved
        ? 'Nothing to approve right now.'
        : 'Nothing to decline right now.';
    }

    switch (pending.type) {
      case 'swap_confirm':
        return approved
          ? this.swapFlowService.confirmSwap(session, user)
          : this.swapFlowService.cancelSwap(session);

      case 'swap_review':
        return this.swapFlowService.handleSwapReview(session, approved, user);

      default:
        return approved
          ? 'Nothing to approve right now.'
          : 'Nothing to decline right now.';
    }
  }

  // ─── Schedule Query ──────────────────────────────────────────

  private async handleConfirmSchedule(
    entities: Record<string, string>,
    session: ConversationSession,
  ): Promise<string> {
    const familyId = session.familyId;

    // Look up the user's role via membership
    const membership = await this.membershipRepo.findOne({
      where: { userId: session.userId, familyId },
    });
    const userRole = membership?.role || 'parent_a';

    // Find active schedule version for this family
    const activeVersion = await this.scheduleVersionRepo.findOne({
      where: { familyId, isActive: true },
    });

    if (!activeVersion) {
      return 'No schedule has been generated yet.';
    }

    // Determine if asking about a specific day or the whole week
    const specificDate = this.resolveDate(entities);

    if (specificDate) {
      const assignment = await this.assignmentRepo.findOne({
        where: {
          scheduleVersionId: activeVersion.id,
          date: specificDate,
        },
      });

      return formatDaySchedule(assignment, specificDate, userRole);
    }

    // Week lookup: current week Mon-Sun
    const { start, end } = this.getCurrentWeekRange();
    const assignments = await this.assignmentRepo.find({
      where: {
        scheduleVersionId: activeVersion.id,
        date: Between(start, end),
      },
      order: { date: 'ASC' },
    });

    if (assignments.length === 0) {
      return 'No schedule found for this week.';
    }

    return formatWeekSchedule(assignments, userRole);
  }

  // ─── Disruption Reporting ────────────────────────────────────

  private async handleReportDisruption(
    entities: Record<string, string>,
    rawText: string,
    user: User,
    session: ConversationSession,
  ): Promise<string> {
    const date = this.resolveDate(entities) || this.todayStr();
    const disruptionType = this.classifyDisruptionType(rawText);

    const disruption = await this.disruptionRepo.save(
      this.disruptionRepo.create({
        familyId: session.familyId,
        reportedBy: user.id,
        type: disruptionType,
        date,
        description: rawText,
        childName: entities.child_name || null,
        status: 'active',
      }),
    );

    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        familyId: session.familyId,
        actorId: user.id,
        action: 'disruption_reported',
        entityType: 'disruption_event',
        entityId: disruption.id,
        metadata: { type: disruptionType, date },
      }),
    );

    const otherParentName = await this.notifyOtherParent(
      session.familyId,
      user.id,
      `${user.displayName} reported a disruption: ${this.formatDisruptionLabel(disruptionType)} on ${date}. Check your schedule for updates.`,
    );

    const label = this.formatDisruptionLabel(disruptionType);
    const notifiedMsg = otherParentName
      ? `${otherParentName} has been notified.`
      : 'Other parent has been notified.';

    return `Got it. ${label} logged for ${date}. ${notifiedMsg}`;
  }

  private async handleReportIllness(
    entities: Record<string, string>,
    rawText: string,
    user: User,
    session: ConversationSession,
  ): Promise<string> {
    const date = this.resolveDate(entities) || this.todayStr();
    const childName = entities.child_name || null;

    const disruption = await this.disruptionRepo.save(
      this.disruptionRepo.create({
        familyId: session.familyId,
        reportedBy: user.id,
        type: 'illness',
        date,
        description: rawText,
        childName,
        status: 'active',
      }),
    );

    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        familyId: session.familyId,
        actorId: user.id,
        action: 'illness_reported',
        entityType: 'disruption_event',
        entityId: disruption.id,
        metadata: { date, childName },
      }),
    );

    const subject = childName || 'your child';
    const otherParentName = await this.notifyOtherParent(
      session.familyId,
      user.id,
      `${user.displayName} reported an illness for ${subject} on ${date}. Please coordinate as needed.`,
    );

    const notifiedMsg = otherParentName
      ? `${otherParentName} has been notified.`
      : 'Other parent has been notified.';
    const target = childName || date;

    return `Got it. Illness reported for ${target}. ${notifiedMsg}`;
  }

  // ─── Viewer Link ────────────────────────────────────────────

  private handleViewSchedule(session: ConversationSession): string {
    const { url } = this.viewerTokenService.generateViewerToken(
      session.familyId,
      session.userId,
    );
    return `Here's your schedule:\n${url}\n\nThis link expires in 7 days.`;
  }

  // ─── Helpers ─────────────────────────────────────────────────

  /**
   * Resolve parsed entities into a YYYY-MM-DD date string.
   */
  private resolveDate(entities: Record<string, string>): string | null {
    const now = new Date();

    if (entities.relative_date) {
      const rel = entities.relative_date.toLowerCase();
      if (rel === 'today' || rel === 'tonight') {
        return this.dateToStr(now);
      }
      if (rel === 'tomorrow') {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        return this.dateToStr(d);
      }
      // "this weekend", "next week" etc. — return null to get full week
      return null;
    }

    if (entities.day) {
      return this.nextOccurrenceOfDay(entities.day);
    }

    if (entities.date) {
      const [month, day] = entities.date.split('/').map(Number);
      const year = now.getFullYear();
      const d = new Date(year, month - 1, day);
      return this.dateToStr(d);
    }

    return null;
  }

  private nextOccurrenceOfDay(dayName: string): string {
    const dayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    const target = dayMap[dayName.toLowerCase()];
    if (target === undefined) return this.todayStr();

    const now = new Date();
    const current = now.getDay();
    let diff = target - current;
    if (diff < 0) diff += 7;
    if (diff === 0) return this.dateToStr(now);

    const d = new Date(now);
    d.setDate(d.getDate() + diff);
    return this.dateToStr(d);
  }

  private getCurrentWeekRange(): { start: string; end: string } {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: this.dateToStr(monday), end: this.dateToStr(sunday) };
  }

  private dateToStr(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private todayStr(): string {
    return this.dateToStr(new Date());
  }

  private classifyDisruptionType(text: string): string {
    const lower = text.toLowerCase();
    if (/school closed|no school|school cancel/.test(lower)) return 'school_closure';
    if (/snow day|weather|ice|storm/.test(lower)) return 'weather_closure';
    if (/holiday/.test(lower)) return 'holiday';
    if (/early dismissal/.test(lower)) return 'early_dismissal';
    if (/cancel/.test(lower)) return 'cancellation';
    if (/closed|closure/.test(lower)) return 'closure';
    return 'other';
  }

  private formatDisruptionLabel(type: string): string {
    const labels: Record<string, string> = {
      school_closure: 'School closure',
      weather_closure: 'Weather closure',
      holiday: 'Holiday',
      early_dismissal: 'Early dismissal',
      cancellation: 'Cancellation',
      closure: 'Closure',
      illness: 'Illness',
      other: 'Disruption',
    };
    return labels[type] || 'Disruption';
  }

  /**
   * Find the other parent in the family and send them an SMS notification.
   * Returns the other parent's display name if found, or null.
   */
  private async notifyOtherParent(
    familyId: string,
    currentUserId: string,
    message: string,
  ): Promise<string | null> {
    const allMembers = await this.membershipRepo.find({
      where: { familyId },
    });

    const otherMember = allMembers.find(
      (m) =>
        m.userId !== currentUserId &&
        (m.role === 'parent_a' || m.role === 'parent_b'),
    );

    if (!otherMember || !otherMember.userId) return null;

    const otherUser = await this.userRepo.findOne({
      where: { id: otherMember.userId },
    });

    if (!otherUser) return null;

    if (otherUser.phoneNumber) {
      await this.messageSenderService.sendMessage(
        otherUser.phoneNumber,
        message,
      );
    }

    return otherUser.displayName;
  }
}
