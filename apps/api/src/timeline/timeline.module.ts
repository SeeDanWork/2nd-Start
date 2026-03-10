import { Module } from '@nestjs/common';
import { TimelineEngineService } from './timeline-engine.service';
import { TimelineController } from './timeline.controller';
import { PersonaEmulatorService } from './personas/persona-emulator.service';
import { MessagingModule } from '../messaging/messaging.module';
import { MetricsModule } from '../metrics/metrics.module';
import { GuardrailsModule } from '../guardrails/guardrails.module';
import { MediationModule } from '../mediation/mediation.module';

@Module({
  imports: [MessagingModule, MetricsModule, GuardrailsModule, MediationModule],
  controllers: [TimelineController],
  providers: [TimelineEngineService, PersonaEmulatorService],
  exports: [TimelineEngineService, PersonaEmulatorService],
})
export class TimelineModule {}
