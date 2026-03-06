import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ConversationSession,
  MessageLog,
  User,
  Family,
  FamilyMembership,
  BaseScheduleVersion,
  OvernightAssignment,
  DisruptionEvent,
  AuditLog,
  Request,
} from '../entities';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { ConversationService } from './conversation.service';
import { MessageParserService } from './message-parser.service';
import { MessageSenderService } from './message-sender.service';
import { SwapFlowService } from './swap-flow.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConversationSession,
      MessageLog,
      User,
      Family,
      FamilyMembership,
      BaseScheduleVersion,
      OvernightAssignment,
      DisruptionEvent,
      AuditLog,
      Request,
    ]),
  ],
  controllers: [MessagingController],
  providers: [
    MessagingService,
    ConversationService,
    MessageParserService,
    MessageSenderService,
    SwapFlowService,
  ],
  exports: [MessagingService, MessageSenderService],
})
export class MessagingModule {}
