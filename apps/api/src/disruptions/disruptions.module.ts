import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisruptionsController } from './disruptions.controller';
import { DisruptionsService } from './disruptions.service';
import {
  DisruptionEvent,
  OverlayPolicyEntity,
  PolicyDecisionRecord,
  AuditLog,
} from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DisruptionEvent,
      OverlayPolicyEntity,
      PolicyDecisionRecord,
      AuditLog,
    ]),
  ],
  controllers: [DisruptionsController],
  providers: [DisruptionsService],
  exports: [DisruptionsService],
})
export class DisruptionsModule {}
