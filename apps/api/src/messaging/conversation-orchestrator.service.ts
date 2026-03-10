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
import { SharingService } from '../sharing/sharing.service';
import { OperatorService } from '../operator/operator.service';
import { SmsOnboardingService } from './sms-onboarding.service';
import { RequestType, RequestStatus } from '@adcp/shared';
import {
  renderStatusReply,
  renderProposalSummary,
  renderAcceptedReply,
  renderDeclinedReply,
  renderHelp,
  renderUnknownIntent,
  renderUnregistered,
  renderUnsubscribed,
  renderConfirmRequest,
  renderCancelled,
  renderNoPending,
  renderError,
  renderBudgetExhausted,
  renderNoActiveSchedule,
  buildOptionSnapshot,
  ProposalOptionSnapshot,
} from './sms-reply-templates';

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
    private readonly sharingService: SharingService,
    private readonly operatorService: OperatorService,
    private readonly smsOnboarding: SmsOnboardingService,
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
      return renderUnsubscribed();
    }

    // 2. Resolve identity
    const identity = await this.identityResolver.resolve(phoneNumber);

    // 3. Unknown number — try code registration
    if (!identity) {
      // Check if the message is a 6-digit registration code
      const code = text.replace(/\s/g, '');
      if (/^\d{6}$/.test(code)) {
        const result = await this.smsOnboarding.registerWithCode(phoneNumber, code);
        if (result) {
          return 'Phone registered. Reply STATUS to check your schedule, or HELP for commands.';
        }
        return 'Invalid or expired code. Check your code and try again.';
      }
      return renderUnregistered();
    }

    // 3b. Kill switch — check if SMS is allowed
    const smsCheck = this.operatorService.isSmsAllowed(identity.familyId);
    if (!smsCheck.allowed) {
      this.logger.warn(`SMS blocked for ${phoneNumber}: ${smsCheck.reason}`);
      return 'SMS is temporarily paused. Try again later.';
    }

    // 3c. Rate limit — 10 inbound per parent per hour
    const rateCheck = this.operatorService.checkRateLimit(identity.userId, 'inbound');
    if (!rateCheck.allowed) {
      this.logger.warn(`Rate limit exceeded for ${phoneNumber}`);
      return 'Rate limit reached. Try again in a few minutes.';
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
      return renderUnknownIntent();
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
        return renderUnsubscribed();
      default:
        return renderUnknownIntent();
    }
  }

  // ── Status Check ───────────────────────────────────────────────

  private async handleStatusCheck(identity: SmsIdentity): Promise<string> {
    try {
      const today = await this.metricsService.getToday(identity.familyId);

      return renderStatusReply({
        tonightParent: today.tonight.parent,
        nextHandoffDate: today.nextHandoff?.date ?? null,
        fairnessDelta: today.fairness?.delta ?? null,
        windowWeeks: today.fairness?.windowWeeks ?? null,
        pendingRequests: today.pendingRequests,
      });
    } catch (err: any) {
      this.logger.error(`Status check failed: ${err.message}`);
      return renderError();
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
        return renderNoPending();
      }

      const request = pendingRequests[0];
      const bundle = await this.proposalsService.getProposals(identity.familyId, request.id);
      if (!bundle || !bundle.options || bundle.options.length === 0) {
        return renderNoPending();
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

      return renderAcceptedReply({
        dates: request.dates || [],
        optionRank: option.rank,
        newVersionNumber: null,
      });
    } catch (err: any) {
      this.logger.error(`Proposal accept failed: ${err.message}`);
      return renderError();
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
        return renderNoPending();
      }

      const request = pendingRequests[0];
      await this.proposalsService.declineProposal(
        identity.familyId,
        request.id,
        identity.userId,
      );

      return renderDeclinedReply({ dates: request.dates || [] });
    } catch (err: any) {
      this.logger.error(`Proposal decline failed: ${err.message}`);
      return renderError();
    }
  }

  // ── Policy Confirm ─────────────────────────────────────────────

  private async handlePolicyConfirm(identity: SmsIdentity): Promise<string> {
    // Policy confirmation is a placeholder — no pending policy system via SMS yet
    return 'No pending policy changes to confirm.';
  }

  // ── Help ───────────────────────────────────────────────────────

  private handleHelp(): string {
    return renderHelp();
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
      return renderUnknownIntent();
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
      return renderNoPending();
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
      return renderCancelled();
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

    return renderConfirmRequest(requestType, dates);
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

      const options = bundle.options || [];
      const snapshots: ProposalOptionSnapshot[] = options.map(buildOptionSnapshot);

      // Create short review link
      let reviewUrl: string | null = null;
      try {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 7);
        const shareLink = await this.sharingService.createShareLink(
          identity.familyId,
          identity.userId,
          {
            scope: `proposal:${request.id}`,
            label: `SMS proposal review`,
            format: 'web',
            expiresAt: expiry.toISOString(),
          },
        );
        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        reviewUrl = `${appUrl}/share/${shareLink.token}`;
      } catch (linkErr: any) {
        this.logger.warn(`Share link creation failed: ${linkErr.message}`);
      }

      return renderProposalSummary({
        optionCount: options.length,
        dates,
        requestType: type,
        reviewUrl,
        options: snapshots,
      });
    } catch (err: any) {
      this.logger.error(`Request creation failed: ${err.message}`);
      await this.setConversationState(conversation, 'IDLE', null);

      if (err.message?.includes('budget')) {
        return renderBudgetExhausted();
      }
      if (err.message?.includes('No active schedule')) {
        return renderNoActiveSchedule();
      }
      return renderError();
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
