import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SyncWorkerService } from './sync-worker.service';

@Injectable()
export class ScheduleSyncListener {
  private readonly logger = new Logger(ScheduleSyncListener.name);

  constructor(private readonly syncWorkerService: SyncWorkerService) {}

  @OnEvent('schedule.activated')
  async handleScheduleActivated(payload: {
    familyId: string;
  }): Promise<void> {
    this.logger.log(
      `Schedule activated for family ${payload.familyId}, triggering calendar sync`,
    );
    await this.syncWorkerService.enqueueSyncSchedule(payload.familyId);
  }
}
