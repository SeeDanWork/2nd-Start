import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SMS_PROVIDER } from './sms.provider';
import { SmsService } from './sms.service';
import { IdentityResolverService } from './identity-resolver.service';
import { ConversationOrchestratorService } from './conversation-orchestrator.service';
import { SmsWebhookController } from './sms-webhook.controller';
import { ConsoleSmsProvider } from './providers/console.provider';
import { TwilioSmsProvider } from './providers/twilio.provider';
import {
  User,
  FamilyMembership,
  Request,
  SmsConversation,
} from '../entities';
import { RequestsModule } from '../requests/requests.module';
import { ProposalsModule } from '../proposals/proposals.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      FamilyMembership,
      Request,
      SmsConversation,
    ]),
    RequestsModule,
    ProposalsModule,
    MetricsModule,
  ],
  controllers: [SmsWebhookController],
  providers: [
    {
      provide: SMS_PROVIDER,
      useFactory: () => {
        const provider = process.env.SMS_PROVIDER || 'console';
        if (provider === 'twilio') {
          return new TwilioSmsProvider();
        }
        return new ConsoleSmsProvider();
      },
    },
    SmsService,
    IdentityResolverService,
    ConversationOrchestratorService,
  ],
  exports: [SmsService, ConversationOrchestratorService],
})
export class MessagingModule {}
