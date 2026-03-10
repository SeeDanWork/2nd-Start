import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GuardrailsService } from '../guardrails/guardrails.service';

@Injectable()
export class EmergencyReturnWorker {
  private readonly logger = new Logger(EmergencyReturnWorker.name);

  constructor(private readonly guardrailsService: GuardrailsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredEmergencies(): Promise<void> {
    this.logger.debug('Checking for expired emergencies...');

    try {
      const count = await this.guardrailsService.checkExpiredEmergencies();

      if (count > 0) {
        this.logger.log(`Returned ${count} expired emergency mode(s) to baseline`);
      }
    } catch (err: any) {
      this.logger.error(
        `Emergency return check failed: ${err.message}`,
        err.stack,
      );
    }
  }
}
