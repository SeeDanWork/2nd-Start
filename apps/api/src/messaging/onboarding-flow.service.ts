import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  User,
  Family,
  Child,
  FamilyMembership,
  ConstraintSet,
  Constraint,
  ConversationSession,
} from '../entities';
import { ConversationService } from './conversation.service';
import { MessageSenderService } from './message-sender.service';
import { ConstraintType, ConstraintHardness, ConstraintOwner } from '@adcp/shared';

// Day name to JS day-of-week (0=Sun...6=Sat)
const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

@Injectable()
export class OnboardingFlowService {
  private readonly logger = new Logger(OnboardingFlowService.name);

  constructor(
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
    private readonly conversationService: ConversationService,
    private readonly messageSenderService: MessageSenderService,
  ) {}

  async handleStep(
    session: ConversationSession,
    messageText: string,
  ): Promise<string> {
    const ctx = (session.context || {}) as Record<string, any>;
    const step: string = ctx.onboardingStep || 'welcome';
    const text = messageText.trim();

    switch (step) {
      case 'welcome':
        return this.stepWelcome(session);

      case 'children_count':
        return this.stepChildrenCount(session, text);

      case 'children_ages':
        return this.stepChildrenAges(session, text, ctx);

      case 'arrangement':
        return this.stepArrangement(session, text);

      case 'distance':
        return this.stepDistance(session, text);

      case 'locked_days':
        return this.stepLockedDays(session, text);

      case 'partner_phone':
        return this.stepPartnerPhone(session, text);

      case 'confirm':
        return this.stepConfirm(session, text, ctx);

      default:
        return this.stepWelcome(session);
    }
  }

  // ── Steps ──────────────────────────────────────────────────────

  private async stepWelcome(session: ConversationSession): Promise<string> {
    await this.updateContext(session, { onboardingStep: 'children_count' });
    return (
      "Welcome to ADCP! I'll help set up your co-parenting schedule.\n\n" +
      'How many children do you have?'
    );
  }

  private async stepChildrenCount(
    session: ConversationSession,
    text: string,
  ): Promise<string> {
    const count = parseInt(text, 10);
    if (isNaN(count) || count < 1 || count > 10) {
      return 'Please enter a number between 1 and 10.';
    }

    await this.updateContext(session, {
      onboardingStep: 'children_ages',
      childCount: count,
    });

    const label = count === 1 ? 'child' : 'children';
    return `Got it, ${count} ${label}. What are their ages? (e.g., 6, 10)`;
  }

  private async stepChildrenAges(
    session: ConversationSession,
    text: string,
    ctx: Record<string, any>,
  ): Promise<string> {
    const childCount: number = ctx.childCount;
    const ages = text
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => parseInt(s, 10));

    if (
      ages.length !== childCount ||
      ages.some((a) => isNaN(a) || a < 0 || a > 18)
    ) {
      return `Please enter ${childCount} ages separated by commas (e.g., 6, 10).`;
    }

    await this.updateContext(session, {
      onboardingStep: 'arrangement',
      childAges: ages,
    });

    return (
      'What custody arrangement?\n\n' +
      'Reply:\n' +
      ' SHARED - Shared/joint custody\n' +
      ' PRIMARY - Primary parent with visits\n' +
      ' UNDECIDED - Not yet decided'
    );
  }

  private async stepArrangement(
    session: ConversationSession,
    text: string,
  ): Promise<string> {
    const lower = text.toLowerCase();
    let arrangement: string | null = null;

    if (lower.includes('shared')) arrangement = 'shared';
    else if (lower.includes('primary')) arrangement = 'primary';
    else if (lower.includes('undecided')) arrangement = 'undecided';

    if (!arrangement) {
      return 'Please reply SHARED, PRIMARY, or UNDECIDED.';
    }

    await this.updateContext(session, {
      onboardingStep: 'distance',
      arrangement,
    });

    return 'How far apart do you and the other parent live? (miles, e.g., 12)';
  }

  private async stepDistance(
    session: ConversationSession,
    text: string,
  ): Promise<string> {
    const miles = parseFloat(text.replace(/[^\d.]/g, ''));
    if (isNaN(miles) || miles < 0) {
      return 'Please enter a distance in miles (e.g., 12).';
    }

    await this.updateContext(session, {
      onboardingStep: 'locked_days',
      distanceMiles: miles,
    });

    return (
      'Are there specific days always with one parent?\n\n' +
      'Examples:\n' +
      " 'Wednesday and Friday are mine'\n" +
      " 'None'\n\n" +
      'Or reply NONE if no locked days.'
    );
  }

  private async stepLockedDays(
    session: ConversationSession,
    text: string,
  ): Promise<string> {
    let lockedDays: number[] = [];

    if (text.toLowerCase() !== 'none') {
      const words = text.toLowerCase().split(/[\s,]+/);
      for (const word of words) {
        if (DAY_MAP[word] !== undefined) {
          lockedDays.push(DAY_MAP[word]);
        }
      }
      // Deduplicate
      lockedDays = [...new Set(lockedDays)];
    }

    await this.updateContext(session, {
      onboardingStep: 'partner_phone',
      lockedDays,
    });

    return "What is the other parent's phone number?\n(e.g., +15551234567)";
  }

  private async stepPartnerPhone(
    session: ConversationSession,
    text: string,
  ): Promise<string> {
    const cleaned = text.replace(/[\s\-().]/g, '');

    // Accept +XXXXXXXXXX (10+ digits) or bare 10-digit US number
    const isValidIntl = /^\+\d{10,15}$/.test(cleaned);
    const isValidUS = /^\d{10}$/.test(cleaned);

    if (!isValidIntl && !isValidUS) {
      return 'Please enter a valid phone number (e.g., +15551234567).';
    }

    const phone = isValidUS ? `+1${cleaned}` : cleaned;

    // Reload context to build summary
    const freshSession = await this.sessionRepo.findOne({
      where: { id: session.id },
    });
    const ctx = (freshSession?.context || session.context) as Record<string, any>;

    await this.updateContext(session, {
      onboardingStep: 'confirm',
      partnerPhone: phone,
    });

    const ages = (ctx.childAges || []).join(', ');
    const arrangement = ctx.arrangement || 'undecided';
    const miles = ctx.distanceMiles ?? '?';
    const lockedDays: number[] = ctx.lockedDays || [];
    const daysStr =
      lockedDays.length > 0
        ? lockedDays.map((d: number) => this.dayName(d)).join(', ')
        : 'None';

    return (
      "Here's your setup:\n" +
      ` Children: ${ages}\n` +
      ` Arrangement: ${arrangement}\n` +
      ` Distance: ${miles} mi\n` +
      ` Locked days: ${daysStr}\n` +
      ` Other parent: ${phone}\n\n` +
      'Reply YES to confirm or NO to start over.'
    );
  }

  private async stepConfirm(
    session: ConversationSession,
    text: string,
    ctx: Record<string, any>,
  ): Promise<string> {
    const lower = text.toLowerCase().trim();

    if (/^(yes|y|confirm|ok|approve)$/i.test(lower)) {
      // Reload full context
      const freshSession = await this.sessionRepo.findOne({
        where: { id: session.id },
      });
      const fullCtx = (freshSession?.context || ctx) as Record<string, any>;

      await this.createFamily(session, fullCtx);

      const phone = fullCtx.partnerPhone || 'the other parent';

      // Transition session out of onboarding
      await this.conversationService.updateState(session.id, 'idle', {
        onboardingStep: null,
        childCount: null,
        childAges: null,
        arrangement: null,
        distanceMiles: null,
        lockedDays: null,
        partnerPhone: null,
      });

      return (
        `All set! Your family is created. We've sent an invite to ${phone}.\n\n` +
        'Once they join, we\'ll generate your first schedule.\n\n' +
        'Type HELP for available commands.'
      );
    }

    if (/^(no|n|restart|start over)$/i.test(lower)) {
      await this.updateContext(session, {
        onboardingStep: 'children_count',
        childCount: null,
        childAges: null,
        arrangement: null,
        distanceMiles: null,
        lockedDays: null,
        partnerPhone: null,
      });
      return "No problem. Let's start over.\n\nHow many children do you have?";
    }

    return 'Please reply YES to confirm or NO to start over.';
  }

  // ── Family Creation ────────────────────────────────────────────

  private async createFamily(
    session: ConversationSession,
    ctx: Record<string, any>,
  ): Promise<void> {
    const childAges: number[] = ctx.childAges || [];
    const arrangement: string = ctx.arrangement || 'shared';
    const distanceMiles: number = ctx.distanceMiles || 0;
    const lockedDays: number[] = ctx.lockedDays || [];
    const partnerPhone: string = ctx.partnerPhone;

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

    // 2. Create membership for the initiating parent
    await this.membershipRepo.save(
      this.membershipRepo.create({
        familyId: family.id,
        userId: session.userId,
        role: 'parent_a',
        label: 'Parent A',
        inviteStatus: 'accepted',
        acceptedAt: new Date(),
      }),
    );

    // 3. Create a User record for the partner (phone only)
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

    // 4. Create membership for partner
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

    // 5. Create Child records
    const now = new Date();
    for (const age of childAges) {
      const dob = new Date(now.getFullYear() - age, now.getMonth(), 1);
      const dobStr = `${dob.getFullYear()}-${String(dob.getMonth() + 1).padStart(2, '0')}-01`;

      await this.childRepo.save(
        this.childRepo.create({
          familyId: family.id,
          firstName: `Child`,
          dateOfBirth: dobStr,
        }),
      );
    }

    // 6. Create ConstraintSet + locked day constraints if specified
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

    // 7. Update session with new familyId
    await this.sessionRepo.update(session.id, { familyId: family.id } as any);

    // 8. Update the initiating user's onboarding status
    await this.userRepo.update(session.userId, {
      onboardingCompleted: true,
    } as any);

    // 9. Send partner invite SMS
    const initiatingUser = await this.userRepo.findOne({
      where: { id: session.userId },
    });
    const inviterName = initiatingUser?.displayName || 'Your co-parent';
    await this.sendPartnerInvite(partnerPhone, inviterName);

    this.logger.log(
      `Family ${family.id} created via messaging onboarding by user ${session.userId}`,
    );
  }

  private async sendPartnerInvite(
    partnerPhone: string,
    inviterName: string,
  ): Promise<void> {
    const message =
      `You've been invited to ADCP by ${inviterName}. ` +
      'Reply START to begin setting up your co-parenting schedule.';

    await this.messageSenderService.sendMessage(partnerPhone, message);
  }

  // ── Partner Onboarding (abbreviated) ───────────────────────────

  async handlePartnerStart(
    session: ConversationSession,
    user: User,
  ): Promise<string> {
    // Find their pending membership
    const membership = await this.membershipRepo.findOne({
      where: { userId: user.id, inviteStatus: 'pending' },
    });

    if (!membership) {
      return 'No pending invitation found for your number.';
    }

    // Accept the membership
    await this.membershipRepo.update(membership.id, {
      inviteStatus: 'accepted',
      acceptedAt: new Date(),
    } as any);

    // Update session with familyId
    await this.sessionRepo.update(session.id, {
      familyId: membership.familyId,
    } as any);

    // Mark user as onboarded
    await this.userRepo.update(user.id, {
      onboardingCompleted: true,
    } as any);

    // Check if we can activate the family
    const family = await this.familyRepo.findOne({
      where: { id: membership.familyId },
    });

    if (family && family.status === 'onboarding') {
      await this.familyRepo.update(family.id, { status: 'active' } as any);
    }

    this.logger.log(
      `Partner ${user.id} completed onboarding for family ${membership.familyId}`,
    );

    return (
      "Welcome! You've joined the family on ADCP.\n\n" +
      "Your co-parenting schedule is being set up. We'll notify you when it's ready.\n\n" +
      'Type HELP for available commands.'
    );
  }

  // ── Helpers ────────────────────────────────────────────────────

  private async updateContext(
    session: ConversationSession,
    updates: Record<string, any>,
  ): Promise<void> {
    const existing = await this.sessionRepo.findOne({
      where: { id: session.id },
    });
    const ctx = { ...(existing?.context || session.context || {}), ...updates };
    await this.sessionRepo.update(session.id, { context: ctx } as any);
    // Keep the in-memory session in sync
    session.context = ctx;
  }

  private dayName(dow: number): string {
    const names = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return names[dow] || `Day ${dow}`;
  }
}
