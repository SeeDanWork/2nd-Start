import { Controller, Get } from '@nestjs/common';
import { SchedulesService } from './schedules.service';

@Controller('families/:familyId/schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 'schedules' };
  }
}
