import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ProposalBundle,
  Request,
  AuditLog,
  FamilyMembership,
  Family,
} from '../entities';
import { GuardrailsModule } from '../guardrails/guardrails.module';
import { NotificationModule } from '../notifications/notification.module';
import { MediationModule } from '../mediation/mediation.module';
import { ProposalExpiryWorker } from './proposal-expiry.worker';
import { EmergencyReturnWorker } from './emergency-return.worker';
import { BudgetResetWorker } from './budget-reset.worker';
import { PreConflictCheckWorker } from './preconflict-check.worker';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    TypeOrmModule.forFeature([
      ProposalBundle,
      Request,
      AuditLog,
      FamilyMembership,
      Family,
    ]),
    GuardrailsModule,
    NotificationModule,
    MediationModule,
  ],
  providers: [
    ProposalExpiryWorker,
    EmergencyReturnWorker,
    BudgetResetWorker,
    PreConflictCheckWorker,
  ],
})
export class JobsModule {}
