import { Controller, Get } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('families/:familyId')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 'metrics' };
  }
}
