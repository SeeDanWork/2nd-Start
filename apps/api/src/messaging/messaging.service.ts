import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  User,
  FamilyMembership,
  MessageLog,
  ConversationSession,
} from '../entities';
import { MessageDirection } from '@adcp/shared';
import { ConversationService } from './conversation.service';
import { MessageSenderService } from './message-sender.service';
import { LlmService, LlmMessage } from './llm.service';
import { LlmToolsService } from './llm-tools.service';
import { OnboardingFlowService } from './onboarding-flow.service';

const SYSTEM_PROMPT_ONBOARDING = `You are ADCP (Anti-Drama Co-Parenting), a friendly and empathetic co-parenting scheduling assistant. You communicate via text message, so keep responses concise (under 300 chars when possible).

You are onboarding a new parent using a structured 5-stage deterministic interview. Your goal is to recover the current operating schedule with enough fidelity to generate a continuity-first baseline. At the start of EVERY turn, call get_onboarding_status to see what stage you're in and what's already collected. Then ask only about what that stage needs.

## Stages:
1. BASELINE EXTRACTION — Ask about: number of children, their ages, and how custody currently works. Let them describe it naturally ("we do every other week", "kids are with me on school days"). Save their description as current_arrangement. If it clearly maps to a known template (alternating_weeks, 2-2-3, 3-4-4-3, 5-2, every_other_weekend), also set candidate_template with your confidence level. If they mention seasonal differences, note seasonal_pattern_mode.

2. ANCHOR EXTRACTION — This is the MOST IMPORTANT stage. Do NOT rush through it. You must reconstruct the FULL weekly picture:
   - Which specific days are ALWAYS with them? (locked nights for parent A). If none, explicitly save no_locked_nights=true.
   - What happens on the OTHER days? Don't assume — ASK.
   - How do weekends work? (alternating between parents, always one parent, split Sat/Sun?)
   - Does the other parent have any midweek visits or overnights?
   - What overall time split do they want? (50/50, 60/40, 70/30?) Save as target_split_pct (e.g. 50 for 50/50).
   - How and when do exchanges happen? (school drop-off, evening pickup, etc.) Save exchange_modality or exchange_timing.
   - Do NOT advance until you have weekend_pattern AND target_split_pct set AND the full week is accounted for.

3. STABILITY CONSTRAINTS — Ask about: distance between homes (miles), co-parent's phone number. For young children (under 5), ask about max consecutive nights. If multiple children, ask whether siblings should always stay together or can have different schedules (sibling_cohesion_policy). The phone number is important but does NOT block advancement — if they hesitate, note it and move on.

4. OPTIMIZATION TARGET — Ask: "What frustrates you about the current setup?" and "What would you change?" Classify into goals (reduce_transitions, shorten_stretches, preserve_weekends, school_night_consistency, reduce_driving, increase_fairness, more_stability, more_flexibility). Must get at least one goal.

5. PREVIEW + CONFIRM — Call generate_schedule_preview to show them the pattern. Summarize everything collected and ask for explicit confirmation. If there are coherence issues flagged in the status, address them with the parent. Only call complete_onboarding after they confirm.

## Rules:
- Call save_onboarding_data EACH TIME you extract new facts. Include only the fields you have data for.
- Accept multiple pieces of info at once if volunteered — don't force one-at-a-time.
- If a field has low confidence (< 0.8), ask a clarifying question before moving on.
- Be warm but efficient. Don't use emoji bullet point lists.
- Be sensitive — avoid assumptions about why they're co-parenting. Use "co-parent" not "ex."
- Image URLs should be on their own line.
- After onboarding completes, a default schedule is generated immediately. The parent can view it right away.
- If they mention a no-contact order, set no_direct_contact=true.

Today's date: ${new Date().toISOString().slice(0, 10)}`;

const SYSTEM_PROMPT_CONVERSATION = `You are ADCP (Anti-Drama Co-Parenting), a friendly co-parenting scheduling assistant communicating via text message. Keep responses concise and helpful (under 300 chars when possible, but can be longer when sharing schedule data).

You help parents manage their co-parenting schedule. You can check the schedule, generate calendar links, handle swap requests, and log disruptions.

Important rules:
- Always use tools to look up real data -- never make up schedule info
- For schedule queries, convert relative dates ("tomorrow", "this Friday") to YYYY-MM-DD format before calling get_schedule
- Be empathetic but neutral -- you serve both parents equally
- If a parent is frustrated, acknowledge their feelings but stay focused on practical help
- Never take sides in parenting disputes
- If asked something outside co-parenting scheduling, gently redirect
- When the parent first messages you (e.g. "hi", "hello"), respond warmly and proactively check their schedule for the current week using get_schedule so they immediately see useful info. Don't just list capabilities -- show them their schedule.
- NEVER use emoji bullet point lists of features as a greeting. Be conversational and helpful from the first message.
- When sharing schedule info, call get_viewer_link to provide the interactive web calendar link. This is the primary way parents view their schedule.
- You can ALSO call generate_week_image to include a quick visual preview alongside the viewer link, but the viewer link is always the main thing to share.
- Image URLs should be on their own line. Viewer links should also be on their own line.
- Never share ONLY an image without the viewer link. The image is a preview; the link is the full interactive calendar.

Today's date: ${new Date().toISOString().slice(0, 10)}`;

const SYSTEM_PROMPT_PARTNER = `You are ADCP (Anti-Drama Co-Parenting), a friendly co-parenting scheduling assistant. A parent has been invited by their co-parent and is joining the platform. Welcome them warmly, explain that their co-parent has set up a shared schedule, and let them know they can start using commands right away.

Keep it brief -- this is text messaging.

Today's date: ${new Date().toISOString().slice(0, 10)}`;

const MAX_HISTORY_MESSAGES = 20;

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageSenderService: MessageSenderService,
    private readonly llmService: LlmService,
    private readonly llmToolsService: LlmToolsService,
    private readonly onboardingFlowService: OnboardingFlowService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(FamilyMembership)
    private readonly membershipRepo: Repository<FamilyMembership>,
    @InjectRepository(MessageLog)
    private readonly messageLogRepo: Repository<MessageLog>,
  ) {}

  async initiateConversation(
    phoneNumber: string,
    channel: string,
  ): Promise<string> {
    try {
      // Check if user already exists
      let user = await this.userRepo.findOne({ where: { phoneNumber } });

      if (user) {
        // Existing user — get their schedule context via LLM
        return this.handleInbound(phoneNumber, '[connected]', channel);
      }

      // New user — create account and get onboarding greeting
      user = await this.userRepo.save(
        this.userRepo.create({
          email: `sms-${Date.now()}@placeholder.adcp`,
          displayName: 'Parent',
          phoneNumber,
          messagingChannel: channel,
          onboardingCompleted: false,
        }),
      );

      const session = await this.conversationService.getOrCreateSession(
        user.id,
        null as any,
        phoneNumber,
        channel,
      );

      await this.conversationService.updateState(session.id, 'onboarding', {
        onboardingStep: 'llm',
        conversationHistory: [],
      });
      session.state = 'onboarding';

      // Call LLM with no user message — just the system prompt triggers the greeting
      const response = await this.handleLlmOnboarding(session, user, '[new user connected — greet them and start onboarding]');
      await this.logMessages(session.id, channel, phoneNumber, '', response);
      return response;
    } catch (err: any) {
      this.logger.error(`Error initiating conversation: ${err?.message || err}`);
      return "Welcome to ADCP! I'll help you set up your co-parenting schedule. How many children do you have?";
    }
  }

  async handleInbound(
    phoneNumber: string,
    body: string,
    channel: string,
    providerMessageId?: string,
  ): Promise<string> {
    try {
      // Find user by phone number
      let user = await this.userRepo.findOne({
        where: { phoneNumber },
      });

      // ── New user: create account and start onboarding ──────
      if (!user) {
        user = await this.userRepo.save(
          this.userRepo.create({
            email: `sms-${Date.now()}@placeholder.adcp`,
            displayName: 'Parent',
            phoneNumber,
            messagingChannel: channel,
            onboardingCompleted: false,
          }),
        );

        const session = await this.conversationService.getOrCreateSession(
          user.id,
          null as any,
          phoneNumber,
          channel,
        );

        await this.conversationService.updateState(session.id, 'onboarding', {
          onboardingStep: 'llm',
          conversationHistory: [],
        });
        session.state = 'onboarding';

        const response = await this.handleLlmOnboarding(session, user, body);
        await this.logMessages(session.id, channel, phoneNumber, body, response, providerMessageId);
        return response;
      }

      // ── Invited partner: hasn't completed onboarding ───────
      if (!user.onboardingCompleted) {
        const pendingMembership = await this.membershipRepo.findOne({
          where: { userId: user.id, inviteStatus: 'pending' },
        });

        if (pendingMembership) {
          const existingSession = await this.findActiveSession(user.id);

          if (existingSession && existingSession.state === 'onboarding') {
            const response = await this.handleLlmOnboarding(existingSession, user, body);
            await this.logMessages(existingSession.id, channel, phoneNumber, body, response, providerMessageId);
            return response;
          }

          const lower = body.trim().toLowerCase();
          if (lower === 'start') {
            const session = await this.conversationService.getOrCreateSession(
              user.id,
              pendingMembership.familyId,
              phoneNumber,
              channel,
            );

            const response = await this.onboardingFlowService.handlePartnerStart(
              session,
              user,
            );

            await this.logMessages(session.id, channel, phoneNumber, body, response, providerMessageId);
            return response;
          }

          return 'Reply START to begin setting up your account.';
        }
      }

      // ── Existing user with active onboarding session ───────
      const existingSession = await this.findActiveSession(user.id);
      if (existingSession && existingSession.state === 'onboarding') {
        const response = await this.handleLlmOnboarding(existingSession, user, body);
        await this.logMessages(existingSession.id, channel, phoneNumber, body, response, providerMessageId);
        return response;
      }

      // ── Normal flow: user has a family ─────────────────────
      const membership = await this.membershipRepo.findOne({
        where: { userId: user.id },
      });

      if (!membership) {
        const session = await this.conversationService.getOrCreateSession(
          user.id,
          null as any,
          phoneNumber,
          channel,
        );

        await this.conversationService.updateState(session.id, 'onboarding', {
          onboardingStep: 'llm',
          conversationHistory: [],
        });
        session.state = 'onboarding';

        const response = await this.handleLlmOnboarding(session, user, body);
        await this.logMessages(session.id, channel, phoneNumber, body, response, providerMessageId);
        return response;
      }

      // Active conversation with LLM
      const session = await this.conversationService.getOrCreateSession(
        user.id,
        membership.familyId,
        phoneNumber,
        channel,
      );

      const response = await this.handleLlmConversation(session, user, body);
      await this.logMessages(session.id, channel, phoneNumber, body, response, providerMessageId);
      return response;
    } catch (err: any) {
      this.logger.error(`Error handling inbound message: ${err?.message || err}`);
      if (err?.stack) this.logger.error(err.stack);
      return "Sorry, something went wrong. Please try again in a moment.";
    }
  }

  // ── LLM-Powered Onboarding ────────────────────────────────

  private async handleLlmOnboarding(
    session: ConversationSession,
    user: User,
    messageText: string,
  ): Promise<string> {
    const ctx = await this.getSessionContext(session.id);
    let history: LlmMessage[] = ctx.conversationHistory || [];

    // Add user message
    history.push({ role: 'user', content: messageText });

    // Trim history to prevent context overflow
    if (history.length > MAX_HISTORY_MESSAGES) {
      history = history.slice(-MAX_HISTORY_MESSAGES);
    }

    const tools = this.llmToolsService.getOnboardingTools();

    const result = await this.llmService.chat(
      SYSTEM_PROMPT_ONBOARDING,
      history,
      tools,
      async (name, input) =>
        this.llmToolsService.handleOnboardingTool(name, input, session, user),
    );

    // Re-read context AFTER tool calls (tools may have updated bootstrapFacts)
    const freshCtx = await this.getSessionContext(session.id);
    await this.updateSessionContext(session.id, {
      ...freshCtx,
      conversationHistory: result.updatedHistory,
    });

    return result.response;
  }

  // ── LLM-Powered Conversation ──────────────────────────────

  private async handleLlmConversation(
    session: ConversationSession,
    user: User,
    messageText: string,
  ): Promise<string> {
    const ctx = await this.getSessionContext(session.id);
    let history: LlmMessage[] = ctx.conversationHistory || [];

    // Add user message
    history.push({ role: 'user', content: messageText });

    if (history.length > MAX_HISTORY_MESSAGES) {
      history = history.slice(-MAX_HISTORY_MESSAGES);
    }

    // Check for pending swap review — add context
    let systemPrompt = SYSTEM_PROMPT_CONVERSATION;
    const pending = await this.conversationService.getPendingAction(session.id);
    if (pending?.type === 'swap_review') {
      systemPrompt += `\n\nIMPORTANT: This parent has a pending swap request to review from ${pending.data.requestingUserName} for ${pending.data.date}. If they seem to be responding to it (yes/no/approve/decline), use the respond_to_swap tool.`;
    }

    const tools = this.llmToolsService.getConversationTools();

    const result = await this.llmService.chat(
      systemPrompt,
      history,
      tools,
      async (name, input) =>
        this.llmToolsService.handleConversationTool(name, input, session, user),
    );

    // Re-read context AFTER tool calls to avoid overwriting tool updates
    const freshCtx = await this.getSessionContext(session.id);
    await this.updateSessionContext(session.id, {
      ...freshCtx,
      conversationHistory: result.updatedHistory,
    });

    return result.response;
  }

  // ── Helpers ───────────────────────────────────────────────

  private async findActiveSession(
    userId: string,
  ): Promise<ConversationSession | null> {
    const session = await this.userRepo.manager
      .getRepository(ConversationSession)
      .findOne({
        where: { userId },
        order: { createdAt: 'DESC' },
      });

    if (!session) return null;
    if (session.expiresAt && session.expiresAt < new Date()) return null;
    return session;
  }

  private async getSessionContext(sessionId: string): Promise<Record<string, any>> {
    const session = await this.userRepo.manager
      .getRepository(ConversationSession)
      .findOne({ where: { id: sessionId } });
    return (session?.context || {}) as Record<string, any>;
  }

  private async updateSessionContext(
    sessionId: string,
    context: Record<string, any>,
  ): Promise<void> {
    await this.userRepo.manager
      .getRepository(ConversationSession)
      .update(sessionId, { context } as any);
  }

  private async logMessages(
    sessionId: string,
    channel: string,
    phoneNumber: string,
    inboundBody: string,
    outboundBody: string,
    providerMessageId?: string,
  ): Promise<void> {
    await this.messageLogRepo.save(
      this.messageLogRepo.create({
        conversationSessionId: sessionId,
        direction: MessageDirection.INBOUND,
        channel,
        fromNumber: phoneNumber,
        toNumber: '',
        body: inboundBody,
        parsedIntent: null,
        confidence: null,
        providerMessageId: providerMessageId || null,
        deliveryStatus: 'delivered',
      }),
    );

    await this.messageLogRepo.save(
      this.messageLogRepo.create({
        conversationSessionId: sessionId,
        direction: MessageDirection.OUTBOUND,
        channel,
        fromNumber: '',
        toNumber: phoneNumber,
        body: outboundBody,
        parsedIntent: null,
        confidence: null,
        providerMessageId: null,
        deliveryStatus: 'sent',
      }),
    );
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
}
