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
import { FamilyContextModule } from '../family-context/family-context.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PreConsentRule,
      ChangeBudgetLedger,
      EmergencyMode,
      AuditLog,
    ]),
    FamilyContextModule,
  ],
  controllers: [GuardrailsController],
  providers: [GuardrailsService],
  exports: [GuardrailsService],
})
export class GuardrailsModule {}
