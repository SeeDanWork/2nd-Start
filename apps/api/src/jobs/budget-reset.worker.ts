import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GuardrailsService } from '../guardrails/guardrails.service';

@Injectable()
export class BudgetResetWorker {
  private readonly logger = new Logger(BudgetResetWorker.name);

  constructor(private readonly guardrailsService: GuardrailsService) {}

  @Cron('0 0 0 1 * *') // Midnight on the 1st of each month
  async handleMonthlyBudgetReset(): Promise<void> {
    this.logger.log('Starting monthly budget reset...');

    try {
      const count = await this.guardrailsService.resetMonthlyBudgets();
      this.logger.log(`Monthly budget reset complete: ${count} budget(s) reset`);
    } catch (err: any) {
      this.logger.error(
        `Monthly budget reset failed: ${err.message}`,
        err.stack,
      );
    }
  }
}
