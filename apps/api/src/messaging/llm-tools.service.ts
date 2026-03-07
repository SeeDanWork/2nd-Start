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
import {
  ConstraintType,
  ConstraintHardness,
  ScheduleTemplate,
  OnboardingStage,
  BootstrapFacts,
  createEmptyBootstrapFacts,
  getRequiredMissingFields,
} from '@adcp/shared';
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
          'Save collected onboarding facts into structured buckets. Call this each time you extract information from the parent. Only include fields you have concrete data for — omit anything not yet discussed.',
        input_schema: {
          type: 'object',
          properties: {
            // ─── Observed Facts (Bucket A) ───
            children_count: {
              type: 'number',
              description: 'Number of children (1-10)',
            },
            children_ages: {
              type: 'array',
              items: { type: 'number' },
              description: 'Ages of children',
            },
            current_arrangement: {
              type: 'string',
              description:
                'Free-text description of how the family currently handles custody. E.g. "we do week on/week off" or "kids are with me during the week, dad gets every other weekend".',
            },
            candidate_template: {
              type: 'string',
              enum: [
                'alternating_weeks',
                '2-2-3',
                '3-4-4-3',
                '5-2',
                'every_other_weekend',
                'custom',
              ],
              description:
                'If the described arrangement clearly maps to a known template, set it here. Only set this if confidence is high.',
            },
            template_confidence: {
              type: 'number',
              description:
                'How confident you are that candidate_template is correct (0.0 to 1.0). Must be >= 0.8 to auto-use.',
            },
            distance_miles: {
              type: 'number',
              description: 'Distance between parents in miles',
            },
            partner_phone: {
              type: 'string',
              description: 'Other parent phone number in E.164 format (e.g. +15551234567)',
            },
            exchange_modality: {
              type: 'string',
              enum: [
                'school_handoff',
                'home_handoff',
                'curbside',
                'third_party',
                'public_location',
              ],
              description: 'How exchanges happen',
            },
            school_daycare_schedule: {
              type: 'array',
              items: { type: 'number' },
              description:
                'Days of week children attend school/daycare (0=Sun...6=Sat)',
            },
            midweek_pattern: {
              type: 'string',
              enum: ['none', 'dinner_visit', 'overnight', 'afternoon'],
              description:
                'Any midweek contact pattern for the non-custodial parent',
            },
            weekend_pattern: {
              type: 'string',
              enum: ['alternating', 'split', 'fixed_one_parent', 'flexible'],
              description: 'How weekends are handled',
            },
            // ─── Parent Constraints (Bucket B) ───
            locked_nights: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  parent: {
                    type: 'string',
                    enum: ['parent_a', 'parent_b'],
                  },
                  days_of_week: {
                    type: 'array',
                    items: { type: 'number' },
                    description: '0=Sun...6=Sat',
                  },
                },
              },
              description:
                'Nights that must always be with a specific parent (e.g. "Wednesdays always with me")',
            },
            max_consecutive_nights: {
              type: 'number',
              description:
                'Maximum nights in a row with one parent. Often age-dependent.',
            },
            school_night_restrictions: {
              type: 'boolean',
              description:
                'Whether school nights have special rules (e.g. no transitions)',
            },
            no_direct_contact: {
              type: 'boolean',
              description: 'Whether parents have a no-contact order',
            },
            // ─── Optimization Goals (Bucket C) ───
            pain_points: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Free-text pain points expressed by the parent (e.g. "too many handoffs", "kids are stressed by transitions")',
            },
            classified_goals: {
              type: 'array',
              items: {
                type: 'string',
                enum: [
                  'reduce_transitions',
                  'shorten_stretches',
                  'preserve_weekends',
                  'school_night_consistency',
                  'reduce_driving',
                  'increase_fairness',
                  'more_stability',
                  'more_flexibility',
                ],
              },
              description:
                'Optimization goals classified from pain points. Map what the parent says to these goals.',
            },
          },
          required: [],
        },
      },
      {
        name: 'get_onboarding_status',
        description:
          'Check current onboarding progress: what stage we are in, what facts have been collected, and what is still missing. Call this at the start of your turn to decide what to ask next.',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'generate_schedule_preview',
        description:
          'Generate a visual preview image showing what the schedule pattern will look like. Call this during the preview_confirmation stage to show the parent what their schedule will look like. Returns an image URL to include in your response.',
        input_schema: {
          type: 'object',
          properties: {
            template: {
              type: 'string',
              enum: [
                'alternating_weeks',
                '2-2-3',
                '3-4-4-3',
                '5-2',
                'every_other_weekend',
                'custom',
              ],
              description: 'Schedule template to preview',
            },
            locked_nights: {
              type: 'array',
              items: { type: 'number' },
              description: 'Days locked to parent A (0=Sun...6=Sat)',
            },
          },
          required: ['template'],
        },
      },
      {
        name: 'complete_onboarding',
        description:
          'Finalize onboarding and create the family. Only call this after ALL required info is collected, a preview has been shown, and the user has confirmed.',
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
      case 'get_onboarding_status':
        return this.getOnboardingStatus(session);
      case 'generate_schedule_preview':
        return this.generateSchedulePreview(input, session);
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

  private async getBootstrapFacts(session: ConversationSession): Promise<BootstrapFacts> {
    const existing = await this.sessionRepo.findOne({ where: { id: session.id } });
    const ctx = (existing?.context || session.context || {}) as Record<string, any>;
    return ctx.bootstrapFacts || createEmptyBootstrapFacts();
  }

  private async saveBootstrapFacts(
    session: ConversationSession,
    facts: BootstrapFacts,
  ): Promise<void> {
    const existing = await this.sessionRepo.findOne({ where: { id: session.id } });
    const ctx = { ...(existing?.context || session.context || {}), bootstrapFacts: facts };
    await this.sessionRepo.update(session.id, { context: ctx } as any);
    session.context = ctx;
  }

  /** Determine which stage the onboarding should be in based on collected facts */
  private computeStage(facts: BootstrapFacts): OnboardingStage {
    const obs = facts.observedFacts;
    const con = facts.constraints;

    // Stage 1: Need children + arrangement description
    if (obs.childrenCount == null || obs.childrenAges == null || obs.childrenAges.length === 0) {
      return OnboardingStage.BASELINE_EXTRACTION;
    }
    if (obs.currentArrangement == null && obs.candidateTemplate == null) {
      return OnboardingStage.BASELINE_EXTRACTION;
    }

    // Stage 2: Need BOTH locked nights AND weekend pattern AND what happens on non-locked days
    // This stage ensures we understand the full weekly picture, not just anchors
    const hasAnchorInfo = con.lockedNights.length > 0 || obs.weekendPattern != null;
    const hasWeekendClarity = obs.weekendPattern != null;
    const hasFullPicture = hasAnchorInfo && hasWeekendClarity;
    if (!hasFullPicture) {
      return OnboardingStage.ANCHOR_EXTRACTION;
    }

    // Stage 3: Need distance + partner phone + exchange modality
    if (obs.distanceMiles == null || obs.partnerPhone == null) {
      return OnboardingStage.STABILITY_CONSTRAINTS;
    }

    // Stage 4: Need at least one optimization goal
    if (facts.optimizationGoals.classifiedGoals.length === 0) {
      return OnboardingStage.OPTIMIZATION_TARGET;
    }

    // Stage 5: Preview + confirm
    if (!facts.complete) {
      return OnboardingStage.PREVIEW_CONFIRMATION;
    }

    return OnboardingStage.COMPLETE;
  }

  /** Map a template string to ScheduleTemplate enum */
  private resolveTemplate(template: string | null): ScheduleTemplate | null {
    if (!template) return null;
    const map: Record<string, ScheduleTemplate> = {
      alternating_weeks: ScheduleTemplate.ALTERNATING_WEEKS,
      '2-2-3': ScheduleTemplate.TWO_TWO_THREE,
      '3-4-4-3': ScheduleTemplate.THREE_FOUR_FOUR_THREE,
      '5-2': ScheduleTemplate.FIVE_TWO,
      every_other_weekend: ScheduleTemplate.EVERY_OTHER_WEEKEND,
      custom: ScheduleTemplate.CUSTOM,
    };
    return map[template] || null;
  }

  /** Map template to arrangement type for schedule generation */
  private templateToArrangement(template: ScheduleTemplate | null): 'shared' | 'primary' | 'undecided' {
    if (!template) return 'shared';
    switch (template) {
      case ScheduleTemplate.EVERY_OTHER_WEEKEND:
      case ScheduleTemplate.FIVE_TWO:
        return 'primary';
      default:
        return 'shared';
    }
  }

  private async saveOnboardingData(
    input: Record<string, any>,
    session: ConversationSession,
  ): Promise<ToolResult> {
    const facts = await this.getBootstrapFacts(session);

    // ─── Bucket A: Observed Facts ───
    if (input.children_count != null) {
      facts.observedFacts.childrenCount = input.children_count;
      facts.confidence['observedFacts.childrenCount'] = 1.0;
    }
    if (input.children_ages != null) {
      facts.observedFacts.childrenAges = input.children_ages;
      facts.confidence['observedFacts.childrenAges'] = 1.0;
    }
    if (input.current_arrangement != null) {
      facts.observedFacts.currentArrangement = input.current_arrangement;
      facts.confidence['observedFacts.currentArrangement'] = 0.9;
    }
    if (input.candidate_template != null) {
      facts.observedFacts.candidateTemplate = this.resolveTemplate(input.candidate_template);
      facts.observedFacts.templateConfidence = input.template_confidence ?? 0.7;
      facts.confidence['observedFacts.candidateTemplate'] = input.template_confidence ?? 0.7;
    }
    if (input.distance_miles != null) {
      facts.observedFacts.distanceMiles = input.distance_miles;
      facts.confidence['observedFacts.distanceMiles'] = 1.0;
    }
    if (input.partner_phone != null) {
      facts.observedFacts.partnerPhone = input.partner_phone;
      facts.confidence['observedFacts.partnerPhone'] = 1.0;
    }
    if (input.exchange_modality != null) {
      facts.observedFacts.exchangeModality = input.exchange_modality;
      facts.confidence['observedFacts.exchangeModality'] = 0.9;
    }
    if (input.school_daycare_schedule != null) {
      facts.observedFacts.schoolDaycareSchedule = input.school_daycare_schedule;
      facts.confidence['observedFacts.schoolDaycareSchedule'] = 1.0;
    }
    if (input.midweek_pattern != null) {
      facts.observedFacts.midweekPattern = input.midweek_pattern;
      facts.confidence['observedFacts.midweekPattern'] = 0.8;
    }
    if (input.weekend_pattern != null) {
      facts.observedFacts.weekendPattern = input.weekend_pattern;
      facts.confidence['observedFacts.weekendPattern'] = 0.8;
    }

    // ─── Bucket B: Constraints ───
    if (input.locked_nights != null) {
      facts.constraints.lockedNights = input.locked_nights.map((ln: any) => ({
        parent: ln.parent,
        daysOfWeek: ln.days_of_week,
      }));
      facts.confidence['constraints.lockedNights'] = 1.0;
    }
    if (input.max_consecutive_nights != null) {
      facts.constraints.maxConsecutiveNights = input.max_consecutive_nights;
      facts.confidence['constraints.maxConsecutiveNights'] = 1.0;
    }
    if (input.school_night_restrictions != null) {
      facts.constraints.schoolNightRestrictions = input.school_night_restrictions;
      facts.confidence['constraints.schoolNightRestrictions'] = 1.0;
    }
    if (input.no_direct_contact != null) {
      facts.constraints.noDirectContact = input.no_direct_contact;
      facts.confidence['constraints.noDirectContact'] = 1.0;
    }

    // ─── Bucket C: Optimization Goals ───
    if (input.pain_points != null) {
      // Append unique pain points
      const existing = new Set(facts.optimizationGoals.painPoints);
      for (const p of input.pain_points) {
        existing.add(p);
      }
      facts.optimizationGoals.painPoints = Array.from(existing);
    }
    if (input.classified_goals != null) {
      const existing = new Set(facts.optimizationGoals.classifiedGoals);
      for (const g of input.classified_goals) {
        existing.add(g);
      }
      facts.optimizationGoals.classifiedGoals = Array.from(existing);
    }

    // Auto-advance stage based on collected facts
    facts.stage = this.computeStage(facts);

    await this.saveBootstrapFacts(session, facts);

    const missing = getRequiredMissingFields(facts);
    const stageLabel = facts.stage.replace(/_/g, ' ');

    return {
      text: `Data saved. Stage: ${stageLabel}. ${missing.length > 0 ? `Still missing: ${missing.join(', ')}.` : 'All required fields collected.'} Continue to the next question for the current stage.`,
    };
  }

  private async getOnboardingStatus(
    session: ConversationSession,
  ): Promise<ToolResult> {
    const facts = await this.getBootstrapFacts(session);
    const missing = getRequiredMissingFields(facts);
    facts.stage = this.computeStage(facts);

    const collected: string[] = [];
    const obs = facts.observedFacts;
    if (obs.childrenCount != null) collected.push(`${obs.childrenCount} children`);
    if (obs.childrenAges?.length) collected.push(`ages: ${obs.childrenAges.join(', ')}`);
    if (obs.currentArrangement) collected.push(`arrangement: "${obs.currentArrangement}"`);
    if (obs.candidateTemplate) collected.push(`template: ${obs.candidateTemplate} (conf: ${obs.templateConfidence})`);
    if (obs.distanceMiles != null) collected.push(`distance: ${obs.distanceMiles}mi`);
    if (obs.partnerPhone) collected.push(`partner: ${obs.partnerPhone}`);
    if (obs.weekendPattern) collected.push(`weekend: ${obs.weekendPattern}`);
    if (obs.midweekPattern) collected.push(`midweek: ${obs.midweekPattern}`);
    if (obs.exchangeModality) collected.push(`exchange: ${obs.exchangeModality}`);
    if (facts.constraints.lockedNights.length > 0) collected.push(`locked nights: ${facts.constraints.lockedNights.length} rules`);
    if (facts.constraints.maxConsecutiveNights != null) collected.push(`max consecutive: ${facts.constraints.maxConsecutiveNights}`);
    if (facts.optimizationGoals.painPoints.length > 0) collected.push(`pain points: ${facts.optimizationGoals.painPoints.length}`);
    if (facts.optimizationGoals.classifiedGoals.length > 0) collected.push(`goals: ${facts.optimizationGoals.classifiedGoals.join(', ')}`);

    // Compute desired split from facts
    const totalLockedA = facts.constraints.lockedNights
      .filter(ln => ln.parent === 'parent_a')
      .reduce((sum, ln) => sum + ln.daysOfWeek.length, 0);
    const totalLockedB = facts.constraints.lockedNights
      .filter(ln => ln.parent === 'parent_b')
      .reduce((sum, ln) => sum + ln.daysOfWeek.length, 0);
    const unassigned = 7 - totalLockedA - totalLockedB;

    const stageGuidance: Record<string, string> = {
      [OnboardingStage.BASELINE_EXTRACTION]:
        'Ask about: number of children, their ages, and how custody currently works. Let them describe naturally. Save their description AND classify the template if recognizable.',
      [OnboardingStage.ANCHOR_EXTRACTION]:
        `Currently ${totalLockedA} nights locked to parent A, ${totalLockedB} to parent B, ${unassigned} unassigned. You MUST ask: (1) What happens on the remaining ${unassigned} days? (2) How do weekends work — alternating, split, or always one parent? (3) Does the other parent have any midweek time? (4) What overall split do they want (50/50, 60/40, 70/30)? Do NOT move on until weekend_pattern is set and the full week is accounted for.`,
      [OnboardingStage.STABILITY_CONSTRAINTS]:
        'Ask about: distance between homes (miles), how exchanges happen (school drop-off, curbside, etc.), and co-parent phone number. For young children (under 5), also ask about max consecutive nights.',
      [OnboardingStage.OPTIMIZATION_TARGET]:
        'Ask: "What frustrates you most about the current arrangement?" and "What would make it better?" Map answers to goals. Must get at least one classified goal before moving on.',
      [OnboardingStage.PREVIEW_CONFIRMATION]:
        'Call generate_schedule_preview to show a 3-week pattern. Summarize the full arrangement and ask for explicit confirmation before calling complete_onboarding.',
    };

    return {
      text: JSON.stringify({
        stage: facts.stage,
        guidance: stageGuidance[facts.stage] || 'Ready to complete.',
        collected,
        missingRequired: missing,
        confidence: facts.confidence,
      }),
    };
  }

  private async completeOnboarding(
    session: ConversationSession,
    user: User,
  ): Promise<ToolResult> {
    const facts = await this.getBootstrapFacts(session);

    const childAges = facts.observedFacts.childrenAges || [];
    const partnerPhone = facts.observedFacts.partnerPhone;
    const template = facts.observedFacts.candidateTemplate;
    const arrangement = this.templateToArrangement(template);
    const distanceMiles = facts.observedFacts.distanceMiles || 0;

    // Collect all locked nights for parent_a
    const lockedDays: number[] = [];
    for (const ln of facts.constraints.lockedNights) {
      if (ln.parent === 'parent_a') {
        lockedDays.push(...ln.daysOfWeek);
      }
    }

    if (!partnerPhone || childAges.length === 0) {
      const missing = getRequiredMissingFields(facts);
      return {
        text: `Cannot complete: missing required data (${missing.join(', ')}). Continue collecting information.`,
      };
    }

    // 1. Create family with full bootstrap facts
    const family = await this.familyRepo.save(
      this.familyRepo.create({
        name: null,
        status: 'onboarding',
        timezone: 'America/New_York',
        onboardingInput: {
          arrangement,
          template: template || undefined,
          distanceMiles,
          childAges,
          lockedDays,
          bootstrapFacts: facts,
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

    // 6. Create constraints from BootstrapFacts
    const constraintSet = await this.constraintSetRepo.save(
      this.constraintSetRepo.create({
        familyId: family.id,
        version: 1,
        isActive: true,
        createdBy: session.userId,
      }),
    );

    // Locked nights
    for (const ln of facts.constraints.lockedNights) {
      await this.constraintRepo.save(
        this.constraintRepo.create({
          constraintSetId: constraintSet.id,
          type: ConstraintType.LOCKED_NIGHT,
          hardness: ConstraintHardness.HARD,
          weight: 100,
          owner: ln.parent,
          parameters: {
            parent: ln.parent,
            daysOfWeek: ln.daysOfWeek,
          },
        }),
      );
    }

    // Max consecutive nights constraint
    if (facts.constraints.maxConsecutiveNights != null) {
      await this.constraintRepo.save(
        this.constraintRepo.create({
          constraintSetId: constraintSet.id,
          type: ConstraintType.MAX_CONSECUTIVE,
          hardness: ConstraintHardness.SOFT,
          weight: 80,
          owner: 'family',
          parameters: {
            maxNights: facts.constraints.maxConsecutiveNights,
          },
        }),
      );
    }

    // 7. Generate default schedule using full bootstrap facts
    await this.generateDefaultSchedule(family.id, arrangement, lockedDays, facts);

    // 8. Set family active
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

    // 12. Viewer link
    const { url } = this.viewerTokenService.generateViewerToken(
      family.id,
      session.userId,
    );

    // Mark facts complete
    facts.stage = OnboardingStage.COMPLETE;
    facts.complete = true;

    this.logger.log(
      `Family ${family.id} created via deterministic onboarding (template: ${template || 'none'}) by user ${session.userId}`,
    );

    return {
      text: `Family created successfully. Schedule generated using ${template || arrangement} pattern. Invite sent to ${partnerPhone}. Viewer link: ${url} — the parent can view their schedule immediately.`,
    };
  }

  // ── Default Schedule Generation ───────────────────────────────

  /**
   * Build a 2-week repeating pattern for the template, respecting locked nights.
   * Returns [week1, week2] — each is 7 elements indexed 0=Sun...6=Sat.
   */
  private buildWeeklyPatterns(
    facts: BootstrapFacts,
  ): [Array<'parent_a' | 'parent_b'>, Array<'parent_a' | 'parent_b'>] {
    const template = facts.observedFacts.candidateTemplate;
    const w1: Array<'parent_a' | 'parent_b'> = new Array(7).fill('parent_a');
    const w2: Array<'parent_a' | 'parent_b'> = new Array(7).fill('parent_a');

    // Determine locked days
    const lockedA = new Set<number>();
    const lockedB = new Set<number>();
    for (const ln of facts.constraints.lockedNights) {
      for (const dow of ln.daysOfWeek) {
        if (ln.parent === 'parent_a') lockedA.add(dow);
        else lockedB.add(dow);
        w1[dow] = ln.parent as 'parent_a' | 'parent_b';
        w2[dow] = ln.parent as 'parent_a' | 'parent_b';
      }
    }

    const unlocked = (d: number) => !lockedA.has(d) && !lockedB.has(d);

    // Template patterns (for unlocked days only)
    // Index: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    switch (template) {
      case ScheduleTemplate.TWO_TWO_THREE: {
        // W1: A-A-B-B-A-A-A  (Mon-Tue=A, Wed-Thu=B, Fri-Sat-Sun=A)
        // W2: B-B-A-A-B-B-B  (mirror)
        const p1: Array<'parent_a' | 'parent_b'> = ['parent_a', 'parent_a', 'parent_b', 'parent_b', 'parent_a', 'parent_a', 'parent_a'];
        const p2: Array<'parent_a' | 'parent_b'> = ['parent_b', 'parent_b', 'parent_a', 'parent_a', 'parent_b', 'parent_b', 'parent_b'];
        //                                           Sun        Mon         Tue         Wed         Thu         Fri         Sat
        for (let d = 0; d < 7; d++) {
          if (unlocked(d)) { w1[d] = p1[d]; w2[d] = p2[d]; }
        }
        break;
      }
      case ScheduleTemplate.THREE_FOUR_FOUR_THREE: {
        // W1: B-A-A-A-B-B-B  (A: Mon-Wed, B: Thu-Sun)
        // W2: A-B-B-B-B-A-A  (B: Mon-Thu, A: Fri-Sun)
        const p1: Array<'parent_a' | 'parent_b'> = ['parent_b', 'parent_a', 'parent_a', 'parent_a', 'parent_b', 'parent_b', 'parent_b'];
        const p2: Array<'parent_a' | 'parent_b'> = ['parent_a', 'parent_b', 'parent_b', 'parent_b', 'parent_b', 'parent_a', 'parent_a'];
        for (let d = 0; d < 7; d++) {
          if (unlocked(d)) { w1[d] = p1[d]; w2[d] = p2[d]; }
        }
        break;
      }
      case ScheduleTemplate.FIVE_TWO: {
        // Same every week: A weekdays, B weekends
        const p: Array<'parent_a' | 'parent_b'> = ['parent_b', 'parent_a', 'parent_a', 'parent_a', 'parent_a', 'parent_a', 'parent_b'];
        for (let d = 0; d < 7; d++) {
          if (unlocked(d)) { w1[d] = p[d]; w2[d] = p[d]; }
        }
        break;
      }
      case ScheduleTemplate.EVERY_OTHER_WEEKEND: {
        // A has weekdays always, weekends alternate
        for (let d = 0; d < 7; d++) {
          if (!unlocked(d)) continue;
          if (d === 0 || d === 6) {
            w1[d] = 'parent_b'; w2[d] = 'parent_a';
          } else {
            w1[d] = 'parent_a'; w2[d] = 'parent_a';
          }
        }
        break;
      }
      case ScheduleTemplate.ALTERNATING_WEEKS:
      default: {
        // Full week alternation
        for (let d = 0; d < 7; d++) {
          if (unlocked(d)) { w1[d] = 'parent_a'; w2[d] = 'parent_b'; }
        }
        break;
      }
    }

    return [w1, w2];
  }

  private async generateDefaultSchedule(
    familyId: string,
    arrangement: string,
    lockedDays: number[],
    facts?: BootstrapFacts,
  ): Promise<void> {
    const today = new Date();
    const horizonStart = this.dateToStr(today);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 8 * 7); // 8 weeks
    const horizonEnd = this.dateToStr(endDate);

    const template = facts?.observedFacts.candidateTemplate;

    // Create schedule version
    const version = await this.scheduleVersionRepo.save(
      this.scheduleVersionRepo.create({
        familyId,
        version: 1,
        constraintSetVersion: 1,
        horizonStart,
        horizonEnd,
        solverStatus: 'default',
        solverMetadata: { source: 'onboarding_default', arrangement, template: template || null },
        createdBy: 'generation',
        isActive: true,
      }),
    );

    // Build weekly pattern(s) from template
    let weekPatternA: Array<'parent_a' | 'parent_b'>;
    let weekPatternB: Array<'parent_a' | 'parent_b'>;

    if (facts) {
      [weekPatternA, weekPatternB] = this.buildWeeklyPatterns(facts);
    } else {
      // Fallback: simple alternating weeks for legacy calls
      weekPatternA = [0, 1, 2, 3, 4, 5, 6].map(dow => {
        if (lockedDays.includes(dow)) return 'parent_a' as const;
        if (arrangement === 'primary') return (dow === 0 || dow === 6) ? 'parent_b' as const : 'parent_a' as const;
        return 'parent_a' as const;
      });
      weekPatternB = weekPatternA.map((p, i) =>
        lockedDays.includes(i) ? p : (p === 'parent_a' ? 'parent_b' as const : 'parent_a' as const),
      );
    }

    // Generate assignments using alternating week patterns
    const assignments: Array<Partial<OvernightAssignment>> = [];
    const cursor = new Date(today);

    while (cursor <= endDate) {
      const dateStr = this.dateToStr(cursor);
      const dow = cursor.getDay();
      const weekNum = Math.floor(
        (cursor.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000),
      );
      const pattern = weekNum % 2 === 0 ? weekPatternA : weekPatternB;
      const assignedTo = pattern[dow];

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
      `Generated default ${template || arrangement} schedule for family ${familyId}: ${assignments.length} days`,
    );
  }

  // ── Image Generation Tools ───────────────────────────────────

  private async generateSchedulePreview(
    input: Record<string, any>,
    session: ConversationSession,
  ): Promise<ToolResult> {
    const facts = await this.getBootstrapFacts(session);
    const template = input.template || facts.observedFacts.candidateTemplate || 'alternating_weeks';

    // Get locked days from input or from bootstrap facts
    const lockedDays = input.locked_nights || facts.constraints.lockedNights
      .filter(ln => ln.parent === 'parent_a')
      .flatMap(ln => ln.daysOfWeek);

    // Map template to arrangement for the image generator
    const arrangement = this.templateToArrangement(this.resolveTemplate(template));

    const filename = await this.scheduleImageService.generateArrangementPreview(
      arrangement,
      lockedDays,
      'You',
      template,
    );

    const imageUrl = `${API_BASE}/messaging/media/${filename}`;
    return {
      text: `Schedule preview generated for "${template}" pattern. Image URL: ${imageUrl}`,
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
