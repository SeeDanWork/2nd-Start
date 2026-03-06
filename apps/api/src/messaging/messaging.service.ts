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

You are onboarding a new parent. Start by warmly welcoming them and asking about their kids — don't wait for them to ask you something. Jump right into setup.

You need to collect:
1. Number of children (1-10)
2. Ages of each child
3. Custody arrangement (shared, primary, or undecided)
4. Distance between parents (in miles)
5. Any locked days (specific days always with this parent, e.g. "Wednesdays are always mine")
6. The other parent's phone number

Collect this information conversationally. You don't need to ask one question at a time -- if the parent volunteers multiple pieces of info, accept them all. Use save_onboarding_data to store info as you collect it.

Once you have ALL required information, summarize what you've collected and ask for confirmation. Only call complete_onboarding after the parent confirms.

After onboarding completes, a default schedule is generated immediately — the parent doesn't need to wait for the other parent to join. Let them know they can ask about their schedule right away.

Be warm but efficient. This is a co-parenting context so be sensitive -- avoid assumptions about why they're co-parenting. Use "the other parent" or "co-parent" rather than "ex."

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

    // Save updated history
    await this.updateSessionContext(session.id, {
      ...ctx,
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

    await this.updateSessionContext(session.id, {
      ...ctx,
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
