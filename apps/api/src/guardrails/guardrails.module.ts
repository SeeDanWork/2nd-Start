import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardrailsController } from './guardrails.controller';
import { GuardrailsService } from './guardrails.service';
import {
  PreConsentRule,
  ChangeBudgetLedger,
  EmergencyMode,
  AuditLog,
} from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PreConsentRule,
      ChangeBudgetLedger,
      EmergencyMode,
      AuditLog,
    ]),
  ],
  controllers: [GuardrailsController],
  providers: [GuardrailsService],
  exports: [GuardrailsService],
})
export class GuardrailsModule {}
