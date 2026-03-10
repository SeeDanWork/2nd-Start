import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmsConversation, SmsConversationState } from '../entities/sms-conversation.entity';
import { ProposalBundle, Request } from '../entities';
import { IdentityResolverService, SmsIdentity } from './identity-resolver.service';
import { SmsService } from './sms.service';
import { classifyIntent, extractOptionNumber, ClassifiedIntent } from './intent-classifier';
import { RequestsService } from '../requests/requests.service';
import { ProposalsService } from '../proposals/proposals.service';
import { MetricsService } from '../metrics/metrics.service';
import { RequestType, RequestStatus } from '@adcp/shared';

@Injectable()
export class ConversationOrchestratorService {
  private readonly logger = new Logger(ConversationOrchestratorService.name);

  constructor(
    @InjectRepository(SmsConversation)
    private readonly conversationRepo: Repository<SmsConversation>,
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    private readonly identityResolver: IdentityResolverService,
    private readonly smsService: SmsService,
    private readonly requestsService: RequestsService,
    private readonly proposalsService: ProposalsService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Main entry point for all inbound SMS messages.
   * Returns the reply text to send back.
   */
  async handleInboundSms(phoneNumber: string, messageBody: string): Promise<string> {
    const text = messageBody.trim();
    this.logger.log(`Inbound SMS from ${phoneNumber}: "${text}"`);

    // 1. Check for STOP
    if (/^\s*(stop|unsubscribe|opt\s*out)\s*$/i.test(text)) {
      await this.updateConversationState(phoneNumber, 'IDLE', null);
      return 'You have been unsubscribed. Reply START to re-subscribe.';
    }

    // 2. Resolve identity
    const identity = await this.identityResolver.resolve(phoneNumber);

    // 3. Unknown number
    if (!identity) {
      return 'This number is not registered. Log in to your ADCP account and add your phone number in Settings to use SMS.';
    }

    // 4. Load or create conversation
    const conversation = await this.getOrCreateConversation(phoneNumber, identity);

    // 5. Handle continuation states
    if (conversation.state === 'AWAITING_CLARIFICATION') {
      return this.handleClarification(identity, conversation, text);
    }
    if (conversation.state === 'AWAITING_CONFIRMATION') {
      return this.handleConfirmation(identity, conversation, text);
    }
    if (conversation.state === 'AWAITING_DATES') {
      return this.handleDatesResponse(identity, conversation, text);
    }

    // 6. Classify intent
    const intent = classifyIntent(text);
    this.logger.debug(`Intent: ${intent.type} (confidence: ${intent.confidence})`);

    // 7. Low confidence or unknown
    if (intent.type === 'UNKNOWN' || intent.confidence < 0.6) {
      await this.setConversationState(conversation, 'AWAITING_CLARIFICATION', {
        originalText: text,
      });
      return 'I didn\'t understand. Reply: STATUS, SWAP, COVER, SICK, ACCEPT, DECLINE, or HELP.';
    }

    // 8. Route to handler
    return this.routeIntent(identity, intent, conversation);
  }

  // ── Intent Router ──────────────────────────────────────────────

  private async routeIntent(
    identity: SmsIdentity,
    intent: ClassifiedIntent,
    conversation: SmsConversation,
  ): Promise<string> {
    switch (intent.type) {
      case 'STATUS_CHECK':
        return this.handleStatusCheck(identity);
      case 'DISRUPTION_REPORT':
        return this.handleDisruptionReport(identity, intent, conversation);
      case 'SWAP_REQUEST':
        return this.handleSwapRequest(identity, intent, conversation);
      case 'COVERAGE_REQUEST':
        return this.handleCoverageRequest(identity, intent, conversation);
      case 'EXTRA_TIME_REQUEST':
        return this.handleExtraTimeRequest(identity, intent, conversation);
      case 'PROPOSAL_ACCEPT':
        return this.handleProposalAccept(identity, intent);
      case 'PROPOSAL_DECLINE':
        return this.handleProposalDecline(identity);
      case 'POLICY_CONFIRM':
        return this.handlePolicyConfirm(identity);
      case 'HELP':
        return this.handleHelp();
      case 'STOP':
        await this.setConversationState(conversation, 'IDLE', null);
        return 'You have been unsubscribed. Reply START to re-subscribe.';
      default:
        return 'I didn\'t understand. Reply HELP for commands.';
    }
  }

  // ── Status Check ───────────────────────────────────────────────

  private async handleStatusCheck(identity: SmsIdentity): Promise<string> {
    try {
      const today = await this.metricsService.getToday(identity.familyId);

      const parts: string[] = [];
      if (today.tonight.parent) {
        parts.push(`Tonight: ${today.tonight.parent}`);
      } else {
        parts.push('No schedule set yet.');
      }

      if (today.nextHandoff) {
        parts.push(`Next handoff: ${today.nextHandoff.date}`);
      }

      if (today.fairness) {
        parts.push(`Fairness delta: ${today.fairness.delta} nights (8wk)`);
      }

      if (today.pendingRequests > 0) {
        parts.push(`${today.pendingRequests} pending request(s)`);
      }

      return parts.join(' | ');
    } catch (err: any) {
      this.logger.error(`Status check failed: ${err.message}`);
      return 'Could not load status. Please try again.';
    }
  }

  // ── Disruption Report ──────────────────────────────────────────

  private async handleDisruptionReport(
    identity: SmsIdentity,
    intent: ClassifiedIntent,
    conversation: SmsConversation,
  ): Promise<string> {
    if (!intent.extractedDates || intent.extractedDates.length === 0) {
      await this.setConversationState(conversation, 'AWAITING_DATES', {
        intentType: 'DISRUPTION_REPORT',
        originalText: intent.rawText,
      });
      return 'Which date(s) are affected? Reply with dates (e.g., 3/15 or March 15).';
    }

    return this.createRequestAndProposals(
      identity,
      RequestType.NEED_COVERAGE,
      intent.extractedDates,
      'Reported via SMS',
      conversation,
    );
  }

  // ── Swap Request ───────────────────────────────────────────────

  private async handleSwapRequest(
    identity: SmsIdentity,
    intent: ClassifiedIntent,
    conversation: SmsConversation,
  ): Promise<string> {
    if (!intent.extractedDates || intent.extractedDates.length === 0) {
      await this.setConversationState(conversation, 'AWAITING_DATES', {
        intentType: 'SWAP_REQUEST',
        originalText: intent.rawText,
      });
      return 'Which date(s) do you want to swap? Reply with dates (e.g., 3/15).';
    }

    return this.createRequestAndProposals(
      identity,
      RequestType.SWAP_DATE,
      intent.extractedDates,
      'Swap via SMS',
      conversation,
    );
  }

  // ── Coverage Request ───────────────────────────────────────────

  private async handleCoverageRequest(
    identity: SmsIdentity,
    intent: ClassifiedIntent,
    conversation: SmsConversation,
  ): Promise<string> {
    if (!intent.extractedDates || intent.extractedDates.length === 0) {
      await this.setConversationState(conversation, 'AWAITING_DATES', {
        intentType: 'COVERAGE_REQUEST',
        originalText: intent.rawText,
      });
      return 'Which date(s) do you need coverage? Reply with dates (e.g., 3/15).';
    }

    return this.createRequestAndProposals(
      identity,
      RequestType.NEED_COVERAGE,
      intent.extractedDates,
      'Coverage request via SMS',
      conversation,
    );
  }

  // ── Extra Time Request ─────────────────────────────────────────

  private async handleExtraTimeRequest(
    identity: SmsIdentity,
    intent: ClassifiedIntent,
    conversation: SmsConversation,
  ): Promise<string> {
    if (!intent.extractedDates || intent.extractedDates.length === 0) {
      await this.setConversationState(conversation, 'AWAITING_DATES', {
        intentType: 'EXTRA_TIME_REQUEST',
        originalText: intent.rawText,
      });
      return 'Which date(s) would you like extra time? Reply with dates (e.g., 3/15).';
    }

    return this.createRequestAndProposals(
      identity,
      RequestType.WANT_TIME,
      intent.extractedDates,
      'Extra time request via SMS',
      conversation,
    );
  }

  // ── Proposal Accept ────────────────────────────────────────────

  private async handleProposalAccept(
    identity: SmsIdentity,
    intent: ClassifiedIntent,
  ): Promise<string> {
    try {
      // Find pending proposals for this family
      const pendingRequests = await this.requestRepo.find({
        where: {
          familyId: identity.familyId,
          status: RequestStatus.PROPOSALS_GENERATED as any,
        },
        order: { createdAt: 'DESC' },
        take: 1,
      });

      if (pendingRequests.length === 0) {
        return 'No pending proposals to accept.';
      }

      const request = pendingRequests[0];
      const bundle = await this.proposalsService.getProposals(identity.familyId, request.id);
      if (!bundle || !bundle.options || bundle.options.length === 0) {
        return 'No proposal options available.';
      }

      // Check if user specified an option number
      const optionNum = extractOptionNumber(intent.rawText);
      const optionIndex = optionNum ? optionNum - 1 : 0;
      const option = bundle.options[optionIndex] || bundle.options[0];

      await this.proposalsService.acceptProposal(
        identity.familyId,
        option.id,
        identity.userId,
      );

      return `Proposal accepted. Schedule updated for ${request.dates?.join(', ') || 'requested dates'}.`;
    } catch (err: any) {
      this.logger.error(`Proposal accept failed: ${err.message}`);
      return 'Could not accept proposal. Please try again.';
    }
  }

  // ── Proposal Decline ───────────────────────────────────────────

  private async handleProposalDecline(identity: SmsIdentity): Promise<string> {
    try {
      const pendingRequests = await this.requestRepo.find({
        where: {
          familyId: identity.familyId,
          status: RequestStatus.PROPOSALS_GENERATED as any,
        },
        order: { createdAt: 'DESC' },
        take: 1,
      });

      if (pendingRequests.length === 0) {
        return 'No pending proposals to decline.';
      }

      const request = pendingRequests[0];
      await this.proposalsService.declineProposal(
        identity.familyId,
        request.id,
        identity.userId,
      );

      return 'Proposal declined. No schedule changes made.';
    } catch (err: any) {
      this.logger.error(`Proposal decline failed: ${err.message}`);
      return 'Could not decline proposal. Please try again.';
    }
  }

  // ── Policy Confirm ─────────────────────────────────────────────

  private async handlePolicyConfirm(identity: SmsIdentity): Promise<string> {
    // Policy confirmation is a placeholder — no pending policy system via SMS yet
    return 'No pending policy changes to confirm.';
  }

  // ── Help ───────────────────────────────────────────────────────

  private handleHelp(): string {
    return 'Commands: STATUS, SWAP [date], COVER [date], SICK [date], ACCEPT, DECLINE, HELP, STOP';
  }

  // ── Continuation Handlers ──────────────────────────────────────

  private async handleClarification(
    identity: SmsIdentity,
    conversation: SmsConversation,
    text: string,
  ): Promise<string> {
    // Re-classify with the new text
    const intent = classifyIntent(text);

    if (intent.type === 'UNKNOWN' || intent.confidence < 0.6) {
      return 'Still not clear. Reply: STATUS, SWAP, COVER, SICK, ACCEPT, DECLINE, or HELP.';
    }

    await this.setConversationState(conversation, 'IDLE', null);
    return this.routeIntent(identity, intent, conversation);
  }

  private async handleConfirmation(
    identity: SmsIdentity,
    conversation: SmsConversation,
    text: string,
  ): Promise<string> {
    const pending = conversation.pendingIntent;
    if (!pending) {
      await this.setConversationState(conversation, 'IDLE', null);
      return 'No pending action. Reply HELP for commands.';
    }

    const lower = text.toLowerCase().trim();
    if (['yes', 'y', 'confirm', 'ok', 'okay'].includes(lower)) {
      await this.setConversationState(conversation, 'IDLE', null);
      const requestType = this.mapIntentToRequestType(pending.intentType as string);
      return this.createRequestAndProposals(
        identity,
        requestType,
        pending.dates as string[],
        (pending.reasonNote as string) || 'Via SMS',
        conversation,
      );
    }

    if (['no', 'n', 'cancel'].includes(lower)) {
      await this.setConversationState(conversation, 'IDLE', null);
      return 'Cancelled. No changes made.';
    }

    return 'Reply YES to confirm or NO to cancel.';
  }

  private async handleDatesResponse(
    identity: SmsIdentity,
    conversation: SmsConversation,
    text: string,
  ): Promise<string> {
    const intent = classifyIntent(text);
    const dates = intent.extractedDates;

    if (!dates || dates.length === 0) {
      return 'I couldn\'t find dates. Please reply with dates like 3/15 or March 15.';
    }

    const pending = conversation.pendingIntent;
    const intentType = pending?.intentType as string || 'COVERAGE_REQUEST';
    const requestType = this.mapIntentToRequestType(intentType);

    // Confirm before creating
    await this.setConversationState(conversation, 'AWAITING_CONFIRMATION', {
      intentType,
      dates,
      reasonNote: (pending?.originalText as string) || 'Via SMS',
    });

    return `Create ${this.friendlyRequestType(requestType)} for ${dates.join(', ')}? Reply YES or NO.`;
  }

  // ── Shared Helpers ─────────────────────────────────────────────

  private async createRequestAndProposals(
    identity: SmsIdentity,
    type: string,
    dates: string[],
    reasonNote: string,
    conversation: SmsConversation,
  ): Promise<string> {
    try {
      const request = await this.requestsService.create(
        identity.familyId,
        identity.userId,
        { type, dates, reasonNote },
      );

      // Generate proposals
      const bundle = await this.proposalsService.generateProposals(
        identity.familyId,
        request.id,
      );

      await this.setConversationState(conversation, 'IDLE', null);

      const optionCount = bundle.options?.length || 0;
      if (optionCount === 0) {
        return `Request created for ${dates.join(', ')}. No proposals could be generated.`;
      }

      return `${optionCount} proposal(s) ready for ${dates.join(', ')}. Reply ACCEPT or DECLINE.`;
    } catch (err: any) {
      this.logger.error(`Request creation failed: ${err.message}`);
      await this.setConversationState(conversation, 'IDLE', null);

      if (err.message?.includes('budget')) {
        return 'Change budget exhausted this month. No more requests allowed.';
      }
      if (err.message?.includes('No active schedule')) {
        return 'No active schedule found. Set up your schedule first.';
      }
      return 'Could not process request. Please try again later.';
    }
  }

  private mapIntentToRequestType(intentType: string): string {
    switch (intentType) {
      case 'DISRUPTION_REPORT':
      case 'COVERAGE_REQUEST':
        return RequestType.NEED_COVERAGE;
      case 'SWAP_REQUEST':
        return RequestType.SWAP_DATE;
      case 'EXTRA_TIME_REQUEST':
        return RequestType.WANT_TIME;
      default:
        return RequestType.NEED_COVERAGE;
    }
  }

  private friendlyRequestType(type: string): string {
    switch (type) {
      case RequestType.NEED_COVERAGE: return 'coverage request';
      case RequestType.SWAP_DATE: return 'swap request';
      case RequestType.WANT_TIME: return 'extra time request';
      default: return 'request';
    }
  }

  // ── Conversation State Management ──────────────────────────────

  private async getOrCreateConversation(
    phoneNumber: string,
    identity: SmsIdentity,
  ): Promise<SmsConversation> {
    let conversation = await this.conversationRepo.findOne({
      where: { phoneNumber },
    });

    if (!conversation) {
      conversation = await this.conversationRepo.save(
        this.conversationRepo.create({
          phoneNumber,
          userId: identity.userId,
          familyId: identity.familyId,
          state: 'IDLE' as SmsConversationState,
          lastMessageAt: new Date(),
        }),
      );
    } else {
      await this.conversationRepo.update(conversation.id, {
        lastMessageAt: new Date(),
        userId: identity.userId,
        familyId: identity.familyId,
      } as any);
    }

    return conversation;
  }

  private async setConversationState(
    conversation: SmsConversation,
    state: SmsConversationState,
    pendingIntent: Record<string, unknown> | null,
  ): Promise<void> {
    conversation.state = state;
    conversation.pendingIntent = pendingIntent;
    await this.conversationRepo.update(conversation.id, {
      state,
      pendingIntent: pendingIntent as any,
    } as any);
  }

  private async updateConversationState(
    phoneNumber: string,
    state: SmsConversationState,
    pendingIntent: Record<string, unknown> | null,
  ): Promise<void> {
    const conversation = await this.conversationRepo.findOne({ where: { phoneNumber } });
    if (conversation) {
      await this.conversationRepo.update(conversation.id, {
        state,
        pendingIntent: pendingIntent as any,
      } as any);
    }
  }
}
