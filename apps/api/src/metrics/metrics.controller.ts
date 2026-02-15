import { Controller, Get, Param, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { LedgerWindowType } from '@adcp/shared';

@Controller('families/:familyId')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('ledger')
  async getLedger(
    @Param('familyId') familyId: string,
    @Query('windows') windows?: string,
  ) {
    const windowList = windows
      ? windows.split(',').map((w) => w.trim())
      : [
          LedgerWindowType.TWO_WEEK,
          LedgerWindowType.FOUR_WEEK,
          LedgerWindowType.EIGHT_WEEK,
          LedgerWindowType.TWELVE_WEEK,
        ];
    return this.metricsService.getLedger(familyId, windowList);
  }

  @Get('stability')
  async getStability(
    @Param('familyId') familyId: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.metricsService.getStability(familyId, start, end);
  }

  @Get('today')
  async getToday(@Param('familyId') familyId: string) {
    return this.metricsService.getToday(familyId);
  }

  @Get('audit')
  async getAuditLog(
    @Param('familyId') familyId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.metricsService.getAuditLog(familyId, limit, offset);
  }

  @Get('summary')
  async getMonthlySummary(
    @Param('familyId') familyId: string,
    @Query('month') month: string,
  ) {
    return this.metricsService.getMonthlySummary(familyId, month);
  }
}
