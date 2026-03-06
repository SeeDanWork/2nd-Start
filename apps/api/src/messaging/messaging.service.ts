import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, FamilyMembership, MessageLog } from '../entities';
import { MessageDirection, MessageIntent } from '@adcp/shared';
import { ConversationService } from './conversation.service';
import { MessageParserService } from './message-parser.service';
import { MessageSenderService } from './message-sender.service';
import { helpMessage } from './templates/help';
import { unknownMessage } from './templates/unknown';
import { confirmMessage } from './templates/confirm';
import { errorMessage } from './templates/error';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageParserService: MessageParserService,
    private readonly messageSenderService: MessageSenderService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(FamilyMembership)
    private readonly membershipRepo: Repository<FamilyMembership>,
    @InjectRepository(MessageLog)
    private readonly messageLogRepo: Repository<MessageLog>,
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
      let response: string;
      switch (parsed.intent) {
        case MessageIntent.HELP:
          response = helpMessage();
          break;
        case MessageIntent.UNKNOWN:
          response = unknownMessage();
          break;
        default:
          response = confirmMessage(parsed.intent, 'This feature is coming soon.');
          break;
      }

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
}
