import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Family } from '../entities';
import { FamilyStatus } from '@adcp/shared';
import { PreConflictService } from '../mediation/preconflict.service';

@Injectable()
export class PreConflictCheckWorker {
  private readonly logger = new Logger(PreConflictCheckWorker.name);

  constructor(
    @InjectRepository(Family)
    private readonly familyRepo: Repository<Family>,
    private readonly preConflictService: PreConflictService,
  ) {}

  @Cron('0 0 8 * * *') // Daily at 8:00 AM
  async handleDailyPreConflictCheck(): Promise<void> {
    this.logger.log('Starting daily pre-conflict check...');

    try {
      const referenceDate = new Date().toISOString().split('T')[0];

      // Get all active families
      const families = await this.familyRepo.find({
        where: { status: FamilyStatus.ACTIVE },
      });

      let totalAlerts = 0;
      let familiesChecked = 0;

      for (const family of families) {
        try {
          const result = await this.preConflictService.runDailyCheck(
            family.id,
            referenceDate,
          );
          totalAlerts += result.alerts.length;
          familiesChecked++;
        } catch (err: any) {
          this.logger.warn(
            `Pre-conflict check failed for family ${family.id}: ${err.message}`,
          );
        }
      }

      this.logger.log(
        `Daily pre-conflict check complete: ${familiesChecked} families checked, ${totalAlerts} alert(s) generated`,
      );
    } catch (err: any) {
      this.logger.error(
        `Daily pre-conflict check failed: ${err.message}`,
        err.stack,
      );
    }
  }
}
