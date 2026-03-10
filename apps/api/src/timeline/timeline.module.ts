import { Module } from '@nestjs/common';
import { TimelineEngineService } from './timeline-engine.service';
import { TimelineController } from './timeline.controller';
import { PersonaEmulatorService } from './personas/persona-emulator.service';
import { MessagingModule } from '../messaging/messaging.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MessagingModule, MetricsModule],
  controllers: [TimelineController],
  providers: [TimelineEngineService, PersonaEmulatorService],
  exports: [TimelineEngineService, PersonaEmulatorService],
})
export class TimelineModule {}
