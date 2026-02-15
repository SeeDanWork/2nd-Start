import { Controller, Get } from '@nestjs/common';
import { HolidaysService } from './holidays.service';

@Controller('families/:familyId/holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get('health')
  health() {
    return { status: 'ok', module: 'holidays' };
  }
}
