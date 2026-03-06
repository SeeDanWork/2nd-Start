import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  User,
  Family,
  Child,
  FamilyMembership,
  ConstraintSet,
  Constraint,
  ConversationSession,
  BaseScheduleVersion,
  OvernightAssignment,
  DisruptionEvent,
  AuditLog,
  Request,
} from '../entities';
import { ConstraintType, ConstraintHardness, ConstraintOwner } from '@adcp/shared';
import { ConversationService } from './conversation.service';
import { MessageSenderService } from './message-sender.service';
import { ViewerTokenService } from './viewer-token.service';
import { ScheduleImageService, CalendarDay } from './schedule-image.service';
import { LlmTool, ToolResult } from './llm.service';

const API_BASE = process.env.APP_URL || `http://localhost:${process.env.APP_PORT || 3000}`;

@Injectable()
export class LlmToolsService {
  private readonly logger = new Logger(LlmToolsService.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageSenderService: MessageSenderService,
    private readonly viewerTokenService: ViewerTokenService,
    private readonly scheduleImageService: ScheduleImageService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Family)
    private readonly familyRepo: Repository<Family>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
    @InjectRepository(FamilyMembership)
    private readonly membershipRepo: Repository<FamilyMembership>,
    @InjectRepository(ConstraintSet)
    private readonly constraintSetRepo: Repository<ConstraintSet>,
    @InjectRepository(Constraint)
    private readonly constraintRepo: Repository<Constraint>,
    @InjectRepository(ConversationSession)
    private readonly sessionRepo: Repository<ConversationSession>,
    @InjectRepository(BaseScheduleVersion)
    private readonly scheduleVersionRepo: Repository<BaseScheduleVersion>,
    @InjectRepository(OvernightAssignment)
    private readonly assignmentRepo: Repository<OvernightAssignment>,
    @InjectRepository(DisruptionEvent)
    private readonly disruptionRepo: Repository<DisruptionEvent>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
  ) {}

  // ── Tool Definitions ─────────────────────────────────────────

  getOnboardingTools(): LlmTool[] {
    return [
      {
        name: 'save_onboarding_data',
        description:
          'Save collected onboarding information. Call this as you gather each piece of info from the parent. Fields not yet collected should be omitted.',
        input_schema: {
          type: 'object',
          properties: {
            children_count: {
              type: 'number',
              description: 'Number of children (1-10)',
            },
            children_ages: {
              type: 'array',
              items: { type: 'number' },
              description: 'Ages of children',
            },
            arrangement: {
              type: 'string',
              enum: ['shared', 'primary', 'undecided'],
              description: 'Custody arrangement type',
            },
            distance_miles: {
              type: 'number',
              description: 'Distance between parents in miles',
            },
            locked_days: {
              type: 'array',
              items: { type: 'number' },
              description:
                'Days of week always with initiating parent (0=Sun, 1=Mon...6=Sat). Empty array if none.',
            },
            partner_phone: {
              type: 'string',
              description: 'Other parent phone number in E.164 format (e.g. +15551234567)',
            },
          },
          required: [],
        },
      },
      {
        name: 'generate_schedule_preview',
        description:
          'Generate a visual preview image showing what the schedule pattern will look like. Call this after collecting arrangement and locked_days to show the parent a preview before confirming. Returns an image URL to include in your response.',
        input_schema: {
          type: 'object',
          properties: {
            arrangement: {
              type: 'string',
              enum: ['shared', 'primary', 'undecided'],
            },
            locked_days: {
              type: 'array',
              items: { type: 'number' },
              description: 'Days locked to parent A (0=Sun...6=Sat)',
            },
          },
          required: ['arrangement'],
        },
      },
      {
        name: 'complete_onboarding',
        description:
          'Finalize onboarding and create the family. Only call this after ALL required info is collected and the user has confirmed.',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ];
  }

  getConversationTools(): LlmTool[] {
    return [
      {
        name: 'get_schedule',
        description:
          'Look up the custody schedule. Returns who has the kids for a date range.',
        input_schema: {
          type: 'object',
          properties: {
            start_date: {
              type: 'string',
              description: 'Start date (YYYY-MM-DD). Defaults to today.',
            },
            end_date: {
              type: 'string',
              description: 'End date (YYYY-MM-DD). Defaults to end of current week.',
            },
          },
          required: [],
        },
      },
      {
        name: 'get_viewer_link',
        description:
          'Generate a web link to view the full calendar schedule visually.',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'request_swap',
        description:
          'Request to swap a custody day with the other parent. Sends notification to the other parent for approval.',
        input_schema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'The date to swap (YYYY-MM-DD)',
            },
            reason: {
              type: 'string',
              description: 'Reason for the swap request',
            },
          },
          required: ['date'],
        },
      },
      {
        name: 'respond_to_swap',
        description:
          'Approve or decline a pending swap request from the other parent.',
        input_schema: {
          type: 'object',
          properties: {
            approved: {
              type: 'boolean',
              description: 'true to approve, false to decline',
            },
          },
          required: ['approved'],
        },
      },
      {
        name: 'report_disruption',
        description:
          'Report a schedule disruption (school closure, illness, weather, etc.)',
        input_schema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'school_closure',
                'weather_closure',
                'illness',
                'holiday',
                'early_dismissal',
                'other',
              ],
              description: 'Type of disruption',
            },
            date: {
              type: 'string',
              description: 'Date of disruption (YYYY-MM-DD)',
            },
            description: {
              type: 'string',
              description: 'Brief description',
            },
            child_name: {
              type: 'string',
              description: 'Name of affected child (if specific)',
            },
          },
          required: ['type', 'date', 'description'],
        },
      },
      {
        name: 'get_family_info',
        description:
          'Get information about the family: children, parents, arrangement.',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'generate_week_image',
        description:
          'Generate a visual image of the weekly schedule. Returns an image URL to include in your response. Use this when showing schedule info to make it visual.',
        input_schema: {
          type: 'object',
          properties: {
            start_date: {
              type: 'string',
              description: 'Start date (YYYY-MM-DD). Defaults to current week.',
            },
          },
          required: [],
        },
      },
      {
        name: 'generate_month_image',
        description:
          'Generate a visual image of the full month calendar. Returns an image URL. Use after onboarding completes or when user asks to see the full calendar.',
        input_schema: {
          type: 'object',
          properties: {
            month: {
              type: 'number',
              description: 'Month number (1-12). Defaults to current month.',
            },
            year: {
              type: 'number',
              description: 'Year. Defaults to current year.',
            },
          },
          required: [],
        },
      },
    ];
  }

  // ── Tool Handlers ────────────────────────────────────────────

  async handleOnboardingTool(
    name: string,
    input: Record<string, any>,
    session: ConversationSession,
    user: User,
  ): Promise<ToolResult> {
    switch (name) {
      case 'save_onboarding_data':
        return this.saveOnboardingData(input, session);
      case 'generate_schedule_preview':
        return this.generateSchedulePreview(input);
      case 'complete_onboarding':
        return this.completeOnboarding(session, user);
      default:
        return { text: `Unknown tool: ${name}` };
    }
  }

  async handleConversationTool(
    name: string,
    input: Record<string, any>,
    session: ConversationSession,
    user: User,
  ): Promise<ToolResult> {
    switch (name) {
      case 'get_schedule':
        return this.getSchedule(input, session);
      case 'get_viewer_link':
        return this.getViewerLink(session);
      case 'request_swap':
        return this.requestSwap(input, session, user);
      case 'respond_to_swap':
        return this.respondToSwap(input, session, user);
      case 'report_disruption':
        return this.reportDisruption(input, session, user);
      case 'get_family_info':
        return this.getFamilyInfo(session);
      case 'generate_week_image':
        return this.generateWeekImage(input, session);
      case 'generate_month_image':
        return this.generateMonthImage(input, session);
      default:
        return { text: `Unknown tool: ${name}` };
    }
  }

  // ── Onboarding Tool Implementations ──────────────────────────

  private async saveOnboardingData(
    input: Record<string, any>,
    session: ConversationSession,
  ): Promise<ToolResult> {
    const existing = await this.sessionRepo.findOne({
      where: { id: session.id },
    });
    const ctx = { ...(existing?.context || session.context || {}), ...input };
    await this.sessionRepo.update(session.id, { context: ctx } as any);
    session.context = ctx;

    return { text: 'Data saved. Continue collecting remaining information.' };
  }

  private async completeOnboarding(
    session: ConversationSession,
    user: User,
  ): Promise<ToolResult> {
    const freshSession = await this.sessionRepo.findOne({
      where: { id: session.id },
    });
    const ctx = (freshSession?.context || session.context || {}) as Record<string, any>;

    const childAges: number[] = ctx.children_ages || [];
    const arrangement: string = ctx.arrangement || 'shared';
    const distanceMiles: number = ctx.distance_miles || 0;
    const lockedDays: number[] = ctx.locked_days || [];
    const partnerPhone: string = ctx.partner_phone;

    if (!partnerPhone || childAges.length === 0) {
      return {
        text: 'Cannot complete: missing required data (children_ages and partner_phone are required).',
      };
    }

    // 1. Create family
    const family = await this.familyRepo.save(
      this.familyRepo.create({
        name: null,
        status: 'onboarding',
        timezone: 'America/New_York',
        onboardingInput: {
          arrangement,
          distanceMiles,
          childAges,
          lockedDays,
        },
      }),
    );

    // 2. Membership for initiating parent
    await this.membershipRepo.save(
      this.membershipRepo.create({
        familyId: family.id,
        userId: session.userId,
        role: 'parent_a',
        label: user.displayName || 'Parent A',
        inviteStatus: 'accepted',
        acceptedAt: new Date(),
      }),
    );

    // 3. Create or find partner user
    let partnerUser = await this.userRepo.findOne({
      where: { phoneNumber: partnerPhone },
    });

    if (!partnerUser) {
      partnerUser = await this.userRepo.save(
        this.userRepo.create({
          email: `pending-${Date.now()}@placeholder.adcp`,
          displayName: 'Parent',
          phoneNumber: partnerPhone,
          onboardingCompleted: false,
        }),
      );
    }

    // 4. Partner membership
    await this.membershipRepo.save(
      this.membershipRepo.create({
        familyId: family.id,
        userId: partnerUser.id,
        role: 'parent_b',
        label: 'Parent B',
        inviteStatus: 'pending',
        inviteEmail: null,
        invitedAt: new Date(),
      }),
    );

    // 5. Create children
    const now = new Date();
    for (const age of childAges) {
      const dob = new Date(now.getFullYear() - age, now.getMonth(), 1);
      const dobStr = `${dob.getFullYear()}-${String(dob.getMonth() + 1).padStart(2, '0')}-01`;
      await this.childRepo.save(
        this.childRepo.create({
          familyId: family.id,
          firstName: 'Child',
          dateOfBirth: dobStr,
        }),
      );
    }

    // 6. Locked day constraints
    if (lockedDays.length > 0) {
      const constraintSet = await this.constraintSetRepo.save(
        this.constraintSetRepo.create({
          familyId: family.id,
          version: 1,
          isActive: true,
          createdBy: session.userId,
        }),
      );

      await this.constraintRepo.save(
        this.constraintRepo.create({
          constraintSetId: constraintSet.id,
          type: ConstraintType.LOCKED_NIGHT,
          hardness: ConstraintHardness.HARD,
          weight: 100,
          owner: ConstraintOwner.PARENT_A,
          parameters: {
            parent: 'parent_a',
            daysOfWeek: lockedDays,
          },
        }),
      );
    }

    // 7. Generate default schedule immediately
    await this.generateDefaultSchedule(family.id, arrangement, lockedDays);

    // 8. Set family active right away
    await this.familyRepo.update(family.id, { status: 'active' } as any);

    // 9. Update session
    await this.sessionRepo.update(session.id, { familyId: family.id } as any);
    await this.conversationService.updateState(session.id, 'idle', {});

    // 10. Mark user onboarded
    await this.userRepo.update(session.userId, {
      onboardingCompleted: true,
    } as any);

    // 11. Send partner invite
    const inviterName = user.displayName || 'Your co-parent';
    await this.messageSenderService.sendMessage(
      partnerPhone,
      `You've been invited to ADCP by ${inviterName}. Reply START to begin setting up your co-parenting schedule.`,
    );

    // 12. Generate viewer link for immediate use
    const { url } = this.viewerTokenService.generateViewerToken(
      family.id,
      session.userId,
    );

    this.logger.log(
      `Family ${family.id} created with default schedule via LLM onboarding by user ${session.userId}`,
    );

    return {
      text: `Family created successfully. A default schedule has been generated based on the ${arrangement} arrangement. Invite sent to ${partnerPhone}. Viewer link: ${url} — the parent can view their schedule immediately. When the other parent joins, the schedule can be adjusted.`,
    };
  }

  // ── Default Schedule Generation ───────────────────────────────

  private async generateDefaultSchedule(
    familyId: string,
    arrangement: string,
    lockedDays: number[],
  ): Promise<void> {
    const today = new Date();
    const horizonStart = this.dateToStr(today);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 8 * 7); // 8 weeks
    const horizonEnd = this.dateToStr(endDate);

    // Create schedule version
    const version = await this.scheduleVersionRepo.save(
      this.scheduleVersionRepo.create({
        familyId,
        version: 1,
        constraintSetVersion: 1,
        horizonStart,
        horizonEnd,
        solverStatus: 'default',
        solverMetadata: { source: 'onboarding_default', arrangement },
        createdBy: 'generation',
        isActive: true,
      }),
    );

    // Generate assignments based on arrangement
    const assignments: Array<Partial<OvernightAssignment>> = [];
    const cursor = new Date(today);

    while (cursor <= endDate) {
      const dateStr = this.dateToStr(cursor);
      const dow = cursor.getDay(); // 0=Sun...6=Sat
      let assignedTo: string;

      if (lockedDays.includes(dow)) {
        // Locked days always go to parent_a (the onboarding parent)
        assignedTo = 'parent_a';
      } else if (arrangement === 'primary') {
        // Primary: parent_a weekdays, parent_b weekends
        assignedTo = (dow === 0 || dow === 6) ? 'parent_b' : 'parent_a';
      } else {
        // Shared / undecided: alternating weeks
        const weekNum = Math.floor(
          (cursor.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000),
        );
        assignedTo = weekNum % 2 === 0 ? 'parent_a' : 'parent_b';
      }

      const prevAssignment = assignments.length > 0
        ? assignments[assignments.length - 1]
        : null;
      const isTransition = prevAssignment
        ? prevAssignment.assignedTo !== assignedTo
        : false;

      assignments.push({
        scheduleVersionId: version.id,
        familyId,
        date: dateStr,
        assignedTo,
        isTransition,
        source: 'generated',
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    await this.assignmentRepo.save(assignments);

    this.logger.log(
      `Generated default ${arrangement} schedule for family ${familyId}: ${assignments.length} days`,
    );
  }

  // ── Image Generation Tools ───────────────────────────────────

  private async generateSchedulePreview(
    input: Record<string, any>,
  ): Promise<ToolResult> {
    const arrangement = input.arrangement || 'shared';
    const lockedDays = input.locked_days || [];

    const filename = await this.scheduleImageService.generateArrangementPreview(
      arrangement,
      lockedDays,
      'You',
    );

    const imageUrl = `${API_BASE}/messaging/media/${filename}`;
    return {
      text: `Schedule preview generated. Image URL: ${imageUrl}`,
    };
  }

  private async generateWeekImage(
    input: Record<string, any>,
    session: ConversationSession,
  ): Promise<ToolResult> {
    const familyId = session.familyId;
    if (!familyId) return { text: 'No family associated.' };

    const activeVersion = await this.scheduleVersionRepo.findOne({
      where: { familyId, isActive: true },
    });
    if (!activeVersion) return { text: 'No schedule found.' };

    const today = new Date();
    const startDate = input.start_date || this.dateToStr(today);
    const endStr = input.start_date
      ? this.dateToStr(new Date(new Date(input.start_date + 'T12:00:00').getTime() + 6 * 86400000))
      : this.dateToStr(this.endOfWeek(today));

    const assignments = await this.assignmentRepo.find({
      where: {
        scheduleVersionId: activeVersion.id,
        date: Between(startDate, endStr),
      },
      order: { date: 'ASC' },
    });

    if (assignments.length === 0) return { text: 'No assignments for this week.' };

    const members = await this.membershipRepo.find({ where: { familyId } });
    const parentA = members.find((m) => m.role === 'parent_a');
    const parentB = members.find((m) => m.role === 'parent_b');

    const days: CalendarDay[] = assignments.map((a) => ({
      date: a.date,
      assignedTo: a.assignedTo as 'parent_a' | 'parent_b',
      isTransition: a.isTransition,
    }));

    const filename = await this.scheduleImageService.generateWeekCard(
      days,
      parentA?.label || 'Parent A',
      parentB?.label || 'Parent B',
    );

    const imageUrl = `${API_BASE}/messaging/media/${filename}`;
    return { text: `Week schedule image generated. Image URL: ${imageUrl}` };
  }

  private async generateMonthImage(
    input: Record<string, any>,
    session: ConversationSession,
  ): Promise<ToolResult> {
    const familyId = session.familyId;
    if (!familyId) return { text: 'No family associated.' };

    const activeVersion = await this.scheduleVersionRepo.findOne({
      where: { familyId, isActive: true },
    });
    if (!activeVersion) return { text: 'No schedule found.' };

    const now = new Date();
    const month = (input.month || now.getMonth() + 1) - 1;
    const year = input.year || now.getFullYear();
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const assignments = await this.assignmentRepo.find({
      where: {
        scheduleVersionId: activeVersion.id,
        date: Between(startDate, endDate),
      },
      order: { date: 'ASC' },
    });

    if (assignments.length === 0) return { text: 'No assignments for this month.' };

    const members = await this.membershipRepo.find({ where: { familyId } });
    const parentA = members.find((m) => m.role === 'parent_a');
    const parentB = members.find((m) => m.role === 'parent_b');

    const days: CalendarDay[] = assignments.map((a) => ({
      date: a.date,
      assignedTo: a.assignedTo as 'parent_a' | 'parent_b',
      isTransition: a.isTransition,
    }));

    const monthLabel = new Date(year, month, 1).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    const filename = await this.scheduleImageService.generateMonthCalendar(
      days,
      parentA?.label || 'Parent A',
      parentB?.label || 'Parent B',
      monthLabel,
    );

    const imageUrl = `${API_BASE}/messaging/media/${filename}`;
    return { text: `Month calendar image generated. Image URL: ${imageUrl}` };
  }

  // ── Conversation Tool Implementations ────────────────────────

  private async getSchedule(
    input: Record<string, any>,
    session: ConversationSession,
  ): Promise<ToolResult> {
    const familyId = session.familyId;
    if (!familyId) return { text: 'No family associated with this session.' };

    const activeVersion = await this.scheduleVersionRepo.findOne({
      where: { familyId, isActive: true },
    });

    if (!activeVersion) {
      return { text: 'No schedule has been generated yet for this family.' };
    }

    const today = new Date();
    const startDate =
      input.start_date || this.dateToStr(today);
    const endDate =
      input.end_date || this.dateToStr(this.endOfWeek(today));

    const assignments = await this.assignmentRepo.find({
      where: {
        scheduleVersionId: activeVersion.id,
        date: Between(startDate, endDate),
      },
      order: { date: 'ASC' },
    });

    if (assignments.length === 0) {
      return { text: `No schedule assignments found between ${startDate} and ${endDate}.` };
    }

    // Get parent labels
    const members = await this.membershipRepo.find({
      where: { familyId },
    });
    const parentA = members.find((m) => m.role === 'parent_a');
    const parentB = members.find((m) => m.role === 'parent_b');
    const labelA = parentA?.label || 'Parent A';
    const labelB = parentB?.label || 'Parent B';

    const lines = assignments.map((a) => {
      const dayName = new Date(a.date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const parent = a.assignedTo === 'parent_a' ? labelA : labelB;
      const transition = a.isTransition ? ' (transition day)' : '';
      return `${dayName}: ${parent}${transition}`;
    });

    return {
      text: `Schedule for ${startDate} to ${endDate}:\n${lines.join('\n')}`,
    };
  }

  private async getViewerLink(
    session: ConversationSession,
  ): Promise<ToolResult> {
    if (!session.familyId) {
      return { text: 'No family associated with this session.' };
    }

    const { url } = this.viewerTokenService.generateViewerToken(
      session.familyId,
      session.userId,
    );

    return {
      text: `Viewer link generated: ${url} (expires in 7 days)`,
    };
  }

  private async requestSwap(
    input: Record<string, any>,
    session: ConversationSession,
    user: User,
  ): Promise<ToolResult> {
    const familyId = session.familyId;
    if (!familyId) return { text: 'No family associated.' };

    const date = input.date;
    const reason = input.reason || 'Swap requested via message';

    // Find active schedule
    const activeSchedule = await this.scheduleVersionRepo.findOne({
      where: { familyId, isActive: true },
    });

    if (!activeSchedule) {
      return { text: 'No active schedule found.' };
    }

    // Check assignment exists
    const assignment = await this.assignmentRepo.findOne({
      where: { scheduleVersionId: activeSchedule.id, date },
    });

    if (!assignment) {
      return { text: `No assignment found for ${date}.` };
    }

    // Create request
    const request = await this.requestRepo.save(
      this.requestRepo.create({
        familyId,
        requestedBy: user.id,
        type: 'swap_date',
        status: 'pending',
        dates: [date],
        reasonTag: 'swap',
        reasonNote: reason,
        urgency: 'normal',
        changeBudgetDebit: 1,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    );

    // Notify other parent
    const memberships = await this.membershipRepo.find({
      where: { familyId },
    });
    const otherMembership = memberships.find(
      (m) => m.userId && m.userId !== user.id,
    );

    let notifiedName = 'the other parent';
    if (otherMembership?.userId) {
      const otherUser = await this.userRepo.findOne({
        where: { id: otherMembership.userId },
      });

      if (otherUser?.phoneNumber) {
        notifiedName = otherUser.displayName || 'the other parent';
        const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });
        await this.messageSenderService.sendMessage(
          otherUser.phoneNumber,
          `${user.displayName} is requesting to swap ${dayLabel}. Reply YES to approve or NO to decline.`,
        );

        // Set up their session for review
        const otherSession = await this.conversationService.getOrCreateSession(
          otherUser.id,
          familyId,
          otherUser.phoneNumber,
          session.channel,
        );
        await this.conversationService.updateState(otherSession.id, 'reviewing');
        await this.conversationService.setPendingAction(otherSession.id, {
          type: 'swap_review',
          requestId: request.id,
          data: {
            date,
            requestingUserId: user.id,
            requestingUserName: user.displayName,
          },
        });
      }
    }

    return {
      text: `Swap request created for ${date}. ${notifiedName} has been notified and will need to approve.`,
    };
  }

  private async respondToSwap(
    input: Record<string, any>,
    session: ConversationSession,
    user: User,
  ): Promise<ToolResult> {
    const pending = await this.conversationService.getPendingAction(session.id);
    if (!pending || pending.type !== 'swap_review') {
      return { text: 'No pending swap request to respond to.' };
    }

    const { requestId } = pending;
    const { date, requestingUserId } = pending.data;
    const approved = input.approved;

    await this.requestRepo.update(requestId!, {
      status: approved ? 'accepted' : 'declined',
    } as any);

    await this.conversationService.clearPendingAction(session.id);
    await this.conversationService.updateState(session.id, 'idle');

    // Notify requesting parent
    const requestingUser = await this.userRepo.findOne({
      where: { id: requestingUserId },
    });

    if (requestingUser?.phoneNumber) {
      const msg = approved
        ? `Your swap request for ${date} was approved by ${user.displayName}.`
        : `Your swap request for ${date} was declined by ${user.displayName}.`;
      await this.messageSenderService.sendMessage(requestingUser.phoneNumber, msg);
    }

    return {
      text: `Swap for ${date} has been ${approved ? 'approved' : 'declined'}. The requesting parent has been notified.`,
    };
  }

  private async reportDisruption(
    input: Record<string, any>,
    session: ConversationSession,
    user: User,
  ): Promise<ToolResult> {
    const familyId = session.familyId;
    if (!familyId) return { text: 'No family associated.' };

    const disruption = await this.disruptionRepo.save(
      this.disruptionRepo.create({
        familyId,
        reportedBy: user.id,
        type: input.type,
        date: input.date,
        description: input.description,
        childName: input.child_name || null,
        status: 'active',
      }),
    );

    await this.auditLogRepo.save(
      this.auditLogRepo.create({
        familyId,
        actorId: user.id,
        action: 'disruption_reported',
        entityType: 'disruption_event',
        entityId: disruption.id,
        metadata: { type: input.type, date: input.date },
      }),
    );

    // Notify other parent
    const memberships = await this.membershipRepo.find({
      where: { familyId },
    });
    const otherMembership = memberships.find(
      (m) => m.userId && m.userId !== user.id,
    );

    let notified = false;
    if (otherMembership?.userId) {
      const otherUser = await this.userRepo.findOne({
        where: { id: otherMembership.userId },
      });
      if (otherUser?.phoneNumber) {
        await this.messageSenderService.sendMessage(
          otherUser.phoneNumber,
          `${user.displayName} reported: ${input.description} on ${input.date}.`,
        );
        notified = true;
      }
    }

    return {
      text: `Disruption logged: ${input.type} on ${input.date}. ${notified ? 'Other parent notified.' : 'Could not notify other parent.'}`,
    };
  }

  private async getFamilyInfo(
    session: ConversationSession,
  ): Promise<ToolResult> {
    const familyId = session.familyId;
    if (!familyId) return { text: 'No family associated.' };

    const family = await this.familyRepo.findOne({
      where: { id: familyId },
    });

    const members = await this.membershipRepo.find({
      where: { familyId },
    });

    const children = await this.childRepo.find({
      where: { familyId },
    });

    const memberInfo = [];
    for (const m of members) {
      if (m.userId) {
        const u = await this.userRepo.findOne({ where: { id: m.userId } });
        memberInfo.push({
          role: m.role,
          label: m.label,
          name: u?.displayName || 'Unknown',
          status: m.inviteStatus,
        });
      }
    }

    const now = new Date();
    const childInfo = children.map((c) => {
      const dob = new Date(c.dateOfBirth as string);
      const age = Math.floor(
        (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
      );
      return { name: c.firstName, age };
    });

    return {
      text: JSON.stringify({
        familyStatus: family?.status,
        arrangement: (family?.onboardingInput as any)?.arrangement,
        members: memberInfo,
        children: childInfo,
      }),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────

  private dateToStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private endOfWeek(d: Date): Date {
    const result = new Date(d);
    const day = result.getDay();
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    result.setDate(result.getDate() + daysUntilSunday);
    return result;
  }
}
