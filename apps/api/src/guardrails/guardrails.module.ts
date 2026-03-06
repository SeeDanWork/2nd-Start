import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardrailsController } from './guardrails.controller';
import { GuardrailsService } from './guardrails.service';
import {
  PreConsentRule,
  ChangeBudgetLedger,
  EmergencyMode,
  AuditLog,
  FamilyMembership,
} from '../entities';
import { FamilyContextModule } from '../family-context/family-context.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PreConsentRule,
      ChangeBudgetLedger,
      EmergencyMode,
      AuditLog,
      FamilyMembership,
    ]),
    FamilyContextModule,
    NotificationModule,
  ],
  controllers: [GuardrailsController],
  providers: [GuardrailsService],
  exports: [GuardrailsService],
})
export class GuardrailsModule {}
