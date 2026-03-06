import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ConversationSession,
  MessageLog,
  User,
  Family,
  FamilyMembership,
  Child,
  ConstraintSet,
  Constraint,
  BaseScheduleVersion,
  OvernightAssignment,
  DisruptionEvent,
  AuditLog,
  Request,
} from '../entities';
import { MessagingController } from './messaging.controller';
import { ViewerController } from './viewer.controller';
import { MessagingService } from './messaging.service';
import { ConversationService } from './conversation.service';
import { MessageSenderService } from './message-sender.service';
import { OnboardingFlowService } from './onboarding-flow.service';
import { ViewerTokenService } from './viewer-token.service';
import { LlmService } from './llm.service';
import { LlmToolsService } from './llm-tools.service';
import { ScheduleImageService } from './schedule-image.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConversationSession,
      MessageLog,
      User,
      Family,
      FamilyMembership,
      Child,
      ConstraintSet,
      Constraint,
      BaseScheduleVersion,
      OvernightAssignment,
      DisruptionEvent,
      AuditLog,
      Request,
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      signOptions: { expiresIn: process.env.JWT_ACCESS_TTL || '1h' },
    }),
  ],
  controllers: [MessagingController, ViewerController],
  providers: [
    MessagingService,
    ConversationService,
    MessageSenderService,
    OnboardingFlowService,
    ViewerTokenService,
    LlmService,
    LlmToolsService,
    ScheduleImageService,
  ],
  exports: [MessagingService, MessageSenderService],
})
export class MessagingModule {}
